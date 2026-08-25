import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  supportCases: [], supportMessages: [], supportEvents: [], supportAssignments: [], supportFeedback: [], supportSlaPolicies: [],
}

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(() => db),
  updateDb: vi.fn(mutator => mutator(db)),
}))

const { createCase, addMessage, getCase, listAdminCases, submitFeedback, updateCase, acquireCaseLock, correctiveAction, configureSupport, runMaintenance, initAttachment } = await import('../services/supportService.js')

beforeEach(() => {
  for (const key of Object.keys(db)) db[key].length = 0
})

describe('customer support cases', () => {
  it('creates a deterministic case with SLA and immutable system events', () => {
    const result = createCase('user-1', { category: 'billing', subject: 'Subscription missing', description: 'I paid but access is still unavailable.' }, 'founder')
    expect(result.ok).toBe(true)
    expect(result.case.caseNumber).toMatch(/^TKT-\d{4}-000001$/)
    expect(result.case.priority).toBe('high')
    expect(db.supportEvents.map(row => row.eventType)).toEqual(['support_case_created', 'support_case_sla_started'])
  })

  it('blocks duplicate open cases but allows security reporting', () => {
    const first = createCase('user-1', { category: 'platform', subject: 'Bug', description: 'The page fails.' })
    const duplicate = createCase('user-1', { category: 'platform', subject: 'Same bug', description: 'Still failing.' })
    const security = createCase('user-1', { category: 'security', subject: 'Account compromised', description: 'I was hacked.' })
    expect(first.ok).toBe(true)
    expect(duplicate.error).toBe('existing_case')
    expect(security.ok).toBe(true)
    expect(security.case.priority).toBe('critical')
  })

  it('keeps customer messages visible and supports audited admin state changes', () => {
    const created = createCase('user-1', { category: 'other', subject: 'Question', description: 'Need help.' })
    const reply = addMessage('user-1', created.case.id, { message: 'Additional context.' })
    const adminReply = addMessage('admin-1', created.case.id, { message: 'We are investigating.' }, true)
    const updated = updateCase('admin-1', created.case.id, { status: 'processing', priority: 'medium' })
    const detail = getCase('user-1', created.case.id)
    expect(reply.ok).toBe(true)
    expect(adminReply.ok).toBe(true)
    expect(updated.case.status).toBe('processing')
    expect(detail.messages.some(row => row.message === 'We are investigating.')).toBe(true)
    expect(db.supportEvents.some(row => row.eventType === 'support_case_updated')).toBe(true)
  })

  it('derives admin queue and accepts one auditable feedback record', () => {
    const created = createCase('user-2', { category: 'platform', subject: 'Slow page', description: 'The page is slow.' })
    expect(listAdminCases().cases).toHaveLength(1)
    expect(submitFeedback('user-2', created.case.id, { rating: 4, resolutionStatus: 'yes' }).ok).toBe(true)
    expect(submitFeedback('user-2', created.case.id, { rating: 5 }).error).toBe('feedback_already_submitted')
  })

  it('supports business-hour configuration, locking, controlled actions, and maintenance', () => {
    configureSupport('admin-1', { businessHoursEnabled: true, duplicateCooldownHours: 2, resolutionGraceHours: 1, retentionDays: 1, incidentThreshold: 2, teams: [{ name: 'Billing', level: 2, categories: ['billing'] }] })
    const created = createCase('user-3', { category: 'billing', subject: 'Payment issue', description: 'Payment failed.' })
    expect(created.ok).toBe(true)
    expect(acquireCaseLock('admin-1', created.case.id).ok).toBe(true)
    expect(acquireCaseLock('admin-2', created.case.id).error).toBe('case_locked')
    expect(correctiveAction('admin-1', created.case.id, { action: 'reissue_credits', amount: 10, confirm: true, reason: 'Verified entitlement mismatch' }).ok).toBe(true)
    expect(runMaintenance().ok).toBe(true)
  })

  it('enforces owner isolation, internal note separation, and attachment storage policy', () => {
    const created = createCase('user-1', { category: 'platform', subject: 'Private', description: 'Card 4111111111111111 email me@example.com' })
    expect(getCase('user-2', created.case.id).error).toBe('case_not_found')
    addMessage('admin-1', created.case.id, { message: 'Internal diagnostic', internal: true }, true)
    expect(getCase('user-1', created.case.id).messages.some(row => row.message.includes('Internal diagnostic'))).toBe(false)
    const attachment = initAttachment('user-1', created.case.id, { name: 'receipt-4111111111111111.pdf', contentType: 'application/pdf', sizeBytes: 100 })
    expect(['evidence_storage_not_configured', 'support_disabled']).toContain(attachment.error)
  })
})
