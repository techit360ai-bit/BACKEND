import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = { supportCases: [], supportMessages: [], supportEvents: [], supportAssignments: [], supportFeedback: [], supportSlaPolicies: [], supportCategories: [], supportTeams: [], supportKnowledgeBase: [], supportTemplates: [], supportAuditLogs: [], supportLocks: [], supportAttachments: [], supportIncidents: [], supportIntelligenceSignals: [], supportSettings: [], notifications: [], users: [], profiles: [], subscriptions: [], walletAccounts: [], creditLedger: [], paymentIntents: [], projects: [] }
vi.mock('../config/database.js', () => ({ readDb: vi.fn(() => db), updateDb: vi.fn(mutator => mutator(db)) }))
vi.mock('../services/supportNotificationService.js', () => ({ deliverSupportNotification: vi.fn(async () => ({ ok: true })), deliverSupportTeamNotification: vi.fn(async () => ({ ok: true })) }))
const service = await import('../services/supportService.js')

beforeEach(() => { for (const value of Object.values(db)) if (Array.isArray(value)) value.length = 0 })

describe('support scale and security contracts', () => {
  it('isolates cases and internal notes across users', () => {
    const created = service.createCase('owner', { category: 'platform', subject: 'Issue', description: 'Private details' })
    service.addMessage('admin', created.case.id, { message: 'private admin note', internal: true }, true)
    expect(service.getCase('other', created.case.id).error).toBe('case_not_found')
    expect(service.getCase('owner', created.case.id).messages.some(row => row.isInternal)).toBe(false)
    expect(service.getCase('admin', created.case.id, true).messages.some(row => row.isInternal)).toBe(true)
  })

  it('handles a 10000-case queue within a bounded in-memory budget', () => {
    const started = performance.now()
    for (let index = 0; index < 10000; index += 1) db.supportCases.push({ id: `case-${index}`, caseNumber: `TKT-2026-${String(index).padStart(6, '0')}`, userId: `user-${index % 1000}`, category: index % 2 ? 'billing' : 'platform', priority: index % 10 === 0 ? 'high' : 'medium', status: index % 4 === 0 ? 'processing' : 'received', subject: `Case ${index}`, description: 'Support evidence', createdAt: new Date(2026, 0, 1).toISOString(), updatedAt: new Date(2026, 0, 1, 0, 0, index % 60).toISOString() })
    const result = service.listAdminCases({ q: 'Case 9999', priority: 'medium' })
    expect(result.ok).toBe(true)
    expect(result.cases.length).toBeLessThanOrEqual(1)
    expect(performance.now() - started).toBeLessThan(1500)
  })

  it('requires confirmation for financial corrective actions', () => {
    const created = service.createCase('owner', { category: 'credits', subject: 'Credits', description: 'Missing credits' })
    expect(service.correctiveAction('admin', created.case.id, { action: 'reissue_credits', amount: 10 }).error).toBe('confirmation_and_reason_required')
    expect(service.correctiveAction('admin', created.case.id, { action: 'reissue_credits', amount: 10, confirm: true, reason: 'Verified mismatch' }).ok).toBe(true)
  })
})
