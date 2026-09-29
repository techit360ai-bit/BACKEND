import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  projects: [], workspaces: [], workspaceMembers: [], projectFiles: [], projectFileVersions: [],
  codeChangeEvents: [], codeSyncStates: [], workspaceModelBindings: [], userModelConnections: [],
}
vi.mock('../config/database.js', () => ({ readDb: vi.fn(() => db), updateDb: vi.fn(mutator => mutator(db)) }))
vi.mock('../services/aiRouterClient.js', () => ({
  requestWorkspaceConversation: vi.fn(),
  computeGsisNarrative: vi.fn(async () => null),
  extractRecommendation: vi.fn(() => null),
}))

const { requestWorkspaceConversation } = await import('../services/aiRouterClient.js')
const { orchestrateCodeTask, planCodeTask, proposeCodeChanges } = await import('../services/codeIntelligenceService.js')

function file(path, content) {
  db.projectFiles.push({ id: `f_${path}`, workspaceId: 'w1', path, content, language: 'typescript', version: 1, contentHash: `hash_${path}` })
}

beforeEach(() => {
  for (const value of Object.values(db)) value.length = 0
  requestWorkspaceConversation.mockReset()
  db.workspaces.push({ id: 'w1', projectId: 'p1', ownerId: 'owner', name: 'Build' })
  file('package.json', JSON.stringify({ scripts: { dev: 'vite', test: 'vitest run', build: 'vite build' }, dependencies: { react: '^19' } }))
  file('src/billing/invoice.ts', 'export function invoiceTotal() { return 0 }')
  file('src/app.ts', 'export const app = true')
})

describe('coding-area intelligence', () => {
  it('derives a deterministic plan from real stored files, with no AI call', async () => {
    const result = await planCodeTask('owner', 'w1', { requirement: 'Fix the invoice total calculation' })
    expect(result.ok).toBe(true)
    expect(result.authoritative).toBe(false)
    expect(result.plan.changes[0].path).toBe('src/billing/invoice.ts')
    expect(result.plan.existingSystems).toContain('React UI')
    expect(result.plan.tests).toContain('npm test')
    expect(result.ai_routing).toMatchObject({ requested: 'platform', applied: 'platform' })
    expect(requestWorkspaceConversation).not.toHaveBeenCalled()
  })

  it('is honest when the workspace has no stored files', async () => {
    for (const value of db.projectFiles) value.deleted = true
    const result = await planCodeTask('owner', 'w1', { requirement: 'Add a dashboard' })
    expect(result.plan.changes).toEqual([])
    expect(result.plan.summary).toContain('no stored project files')
  })

  it('discloses when a personal connection is requested but the router serves the platform model', async () => {
    db.userModelConnections.push({ id: 'conn_1', userId: 'owner', provider: 'openai', displayName: 'My key', status: 'active' })
    db.workspaceModelBindings.push({ id: 'bind_1', workspaceId: 'w1', userId: 'owner', connectionId: 'conn_1', modelId: 'gpt-4o', operations: ['plan'], status: 'active' })
    const result = await planCodeTask('owner', 'w1', { requirement: 'Fix the invoice total' })
    expect(result.ai_routing).toMatchObject({ requested: 'byok', applied: 'platform', reason: 'byok_not_supported_by_ai_router', connectionName: 'My key' })
  })

  it('rejects a proposal instead of inventing code when the AI router is unavailable', async () => {
    requestWorkspaceConversation.mockResolvedValue(null)
    const result = await proposeCodeChanges('owner', 'w1', { requirement: 'Fix the invoice total' }, 'jwt')
    expect(result).toMatchObject({ ok: false, status: 503, error: 'ai_router_unavailable' })
  })

  it('rejects unparseable AI output and unsafe paths', async () => {
    requestWorkspaceConversation.mockResolvedValue({ message: 'Sure! Here is the code...' })
    expect(await proposeCodeChanges('owner', 'w1', { requirement: 'Fix it' }, 'jwt')).toMatchObject({ error: 'ai_proposal_unparseable' })

    requestWorkspaceConversation.mockResolvedValue({ message: '```json\n{"summary":"s","changes":[{"path":".env","content":"x"}]}\n```' })
    expect(await proposeCodeChanges('owner', 'w1', { requirement: 'Fix it' }, 'jwt')).toMatchObject({ error: 'ai_proposal_rejected' })
  })

  it('accepts a valid proposal and keeps only real workspace paths', async () => {
    requestWorkspaceConversation.mockResolvedValue({
      message: '```json\n{"summary":"Fix invoice","changes":[{"path":"src/billing/invoice.ts","content":"export function invoiceTotal() { return 42 }","reason":"correct total"},{"path":"nope/missing.ts","content":"x"}],"tests":["npm test"],"securityNotes":["no secrets"]}\n```',
      model_used: 'platform-default',
    })
    const result = await proposeCodeChanges('owner', 'w1', { requirement: 'Fix the invoice total' }, 'jwt')
    expect(result.ok).toBe(true)
    expect(result.applied).toBe(false)
    expect(result.proposal.changes).toHaveLength(1)
    expect(result.proposal.changes[0].path).toBe('src/billing/invoice.ts')
    expect(result.ai_model).toBe('platform-default')
  })

  it('orchestrates deterministic stages without performing the work', async () => {
    const result = await orchestrateCodeTask('owner', 'w1', { requirement: 'Fix the invoice total', mode: 'autonomous' })
    expect(result.execution).toMatchObject({ performed: false, mutation_free: true })
    expect(result.orchestration.stages.map(stage => stage.stage)).toEqual(['execution_intelligence', 'mvp_builder', 'product_architect'])
    expect(result.orchestration.recommendedFlow).toEqual(['Plan', 'Code', 'Test', 'Debugger', 'Security', 'Review', 'Apply'])
    expect(result.orchestration.stages[1].actions).toContain('modify src/billing/invoice.ts')
  })

  it('denies access to a workspace the caller does not own', async () => {
    expect(await planCodeTask('stranger', 'w1', { requirement: 'x' })).toMatchObject({ ok: false, status: 403 })
  })
})
