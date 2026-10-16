import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(),
  updateAuthorityDb: vi.fn(),
  loadAuthoritySnapshot: vi.fn(),
}))
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { settleUsage, usageSettlementHealth, workflowBudget } from '../services/usageSettlementService.js'

function makeDb() {
  return { walletAccounts: [], creditLedger: [], usageEvents: [], usageReservations: [], subscriptions: [], workflowBudgets: [] }
}

function seedReservation(db, { requestId, workflowId, maxCostUsd }) {
  db.usageReservations.push({
    id: `res_${requestId}`, reservationId: requestId, requestId, userId: 'u1', workspaceId: 'w1',
    taskType: 'chat', reservedCredits: 12, settledCredits: 0, releasedCredits: 0, fundingSource: 'payg',
    status: 'reserved', grantId: requestId,
    metadata: workflowId ? { workflowId, ...(maxCostUsd != null ? { maxWorkflowCostUsd: maxCostUsd } : {}) } : {},
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  })
}

function fact(requestId, extra = {}) {
  return {
    request_id: requestId, user_id: 'u1', workspace_id: 'w1', task_type: 'chat',
    provider: 'openai', model: 'm', status: 'completed', prompt_tokens: 10, completion_tokens: 5,
    total_tokens: 15, provider_cost_usd: 0.6, latency_ms: 5, attempt_count: 1, cache_hit: false,
    reservation_id: requestId, metadata: {}, ...extra,
  }
}

let db
beforeEach(() => {
  db = makeDb()
  readAuthorityDb.mockReturnValue(db)
  updateAuthorityDb.mockImplementation(mutator => mutator(db))
})

describe('workflow budget persistence and reconciliation', () => {
  it('accumulates settled sub-requests and reconciles against the grant ceiling', () => {
    seedReservation(db, { requestId: 'r1', workflowId: 'wf-1', maxCostUsd: 1.0 })
    const first = settleUsage(fact('r1', { workflow_id: 'wf-1', cost_status: 'estimated', pricing_version: 'v1' }))
    expect(first.ok).toBe(true)
    expect(first.workflowBudget).toMatchObject({
      workflowId: 'wf-1', calls: 1, settledProviderCostUsd: 0.6, maxCostUsd: 1.0, status: 'within', reconciled: true, pricingVersion: 'v1',
    })
    expect(first.workflowBudget.remainingCostUsd).toBeCloseTo(0.4, 8)

    seedReservation(db, { requestId: 'r2', workflowId: 'wf-1', maxCostUsd: 1.0 })
    const second = settleUsage(fact('r2', { workflow_id: 'wf-1', cost_status: 'estimated' }))
    expect(second.workflowBudget.settledProviderCostUsd).toBeCloseTo(1.2, 8)
    expect(second.workflowBudget.status).toBe('exceeded')
    expect(second.workflowBudget.remainingCostUsd).toBeCloseTo(-0.2, 8)
    expect(db.workflowBudgets).toHaveLength(1)
  })

  it('flags a workflow as unreconciled while any sub-request is pending_reconciliation', () => {
    seedReservation(db, { requestId: 'r1', workflowId: 'wf-2', maxCostUsd: 5 })
    const result = settleUsage(fact('r1', { workflow_id: 'wf-2', cost_status: 'pending_reconciliation' }))
    expect(result.workflowBudget.costStatus).toBe('pending_reconciliation')
    expect(result.workflowBudget.reconciled).toBe(false)
  })

  it('does not create a workflow budget when no workflow id is present', () => {
    seedReservation(db, { requestId: 'r1' })
    const result = settleUsage(fact('r1'))
    expect(result.workflowBudget).toBeNull()
    expect(db.workflowBudgets).toHaveLength(0)
  })

  it('is idempotent for a replayed settlement', () => {
    seedReservation(db, { requestId: 'r1', workflowId: 'wf-3', maxCostUsd: 1 })
    settleUsage(fact('r1', { workflow_id: 'wf-3' }))
    const replay = settleUsage(fact('r1', { workflow_id: 'wf-3' }))
    expect(replay.idempotent).toBe(true)
    expect(replay.workflowBudget.calls).toBe(1)
    expect(db.workflowBudgets[0].settledProviderCostUsd).toBeCloseTo(0.6, 8)
  })

  it('exposes the workflow snapshot and health counters', () => {
    seedReservation(db, { requestId: 'r1', workflowId: 'wf-4', maxCostUsd: 0.1 })
    settleUsage(fact('r1', { workflow_id: 'wf-4' }))
    expect(workflowBudget('wf-4').status).toBe('exceeded')
    const health = usageSettlementHealth()
    expect(health.workflows).toBe(1)
    expect(health.workflowsOverBudget).toBe(1)
  })

  it('reuses the ceiling from the reservation metadata for later sub-requests', () => {
    seedReservation(db, { requestId: 'r1', workflowId: 'wf-5', maxCostUsd: 2 })
    settleUsage(fact('r1', { workflow_id: 'wf-5' }))
    seedReservation(db, { requestId: 'r2', workflowId: 'wf-5' })
    const second = settleUsage(fact('r2', { workflow_id: 'wf-5' }))
    expect(second.workflowBudget.maxCostUsd).toBe(2)
  })
})
