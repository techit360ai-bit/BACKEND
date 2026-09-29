import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  workspaces: [], workspaceMembers: [], workspaceTasks: [], workspaceConnectors: [], connectorCredentials: [],
}
vi.mock('../config/database.js', () => ({
  readDb: vi.fn(() => db),
  updateDb: vi.fn(mutator => mutator(db)),
}))
vi.mock('../services/aiRouterClient.js', () => ({
  requestWorkspaceConversation: vi.fn(),
  computeGsisNarrative: vi.fn(async () => null),
  extractRecommendation: vi.fn(() => null),
}))

const { requestWorkspaceConversation } = await import('../services/aiRouterClient.js')
const { appendWorkspaceTaskEvent, getWorkspaceTask, runWorkspaceTask } = await import('../services/workspaceTaskService.js')
const { connectorCredentialStatus, removeConnectorCredential, setConnectorCredential } = await import('../services/connectorCredentialService.js')

function reset() {
  for (const value of Object.values(db)) value.length = 0
  requestWorkspaceConversation.mockReset()
  db.workspaces.push({ id: 'w1', projectId: 'p1', ownerId: 'owner', name: 'Build' })
  db.workspaceTasks.push({ id: 't1', workspaceId: 'w1', ownerId: 'owner', title: 'Ship it', prompt: 'Add a billing summary', status: 'queued', events: [] })
  db.workspaceConnectors.push({ id: 'c1', workspaceId: 'w1', ownerId: 'owner', name: 'Slack', status: 'disconnected' })
}
beforeEach(reset)

describe('workspace task transport', () => {
  it('exposes a task with its event transcript', () => {
    const result = getWorkspaceTask('owner', 'w1', 't1')
    expect(result.ok).toBe(true)
    expect(result.task.prompt).toBe('Add a billing summary')
    expect(result.task.events).toEqual([])
  })

  it('rejects access for a non-member and unknown tasks', () => {
    expect(getWorkspaceTask('stranger', 'w1', 't1')).toMatchObject({ ok: false, status: 404 })
    expect(getWorkspaceTask('owner', 'w1', 'nope')).toMatchObject({ ok: false, status: 404, error: 'task_not_found' })
  })

  it('appends a validated event and updates status', () => {
    const result = appendWorkspaceTaskEvent('owner', 'w1', 't1', { type: 'message', text: 'looking now', status: 'running' })
    expect(result.ok).toBe(true)
    expect(result.event.type).toBe('message')
    expect(result.task.status).toBe('running')
    expect(result.task.events).toHaveLength(1)
    const coerced = appendWorkspaceTaskEvent('owner', 'w1', 't1', { type: 'not-a-type' })
    expect(coerced.event.type).toBe('message')
  })

  it('runs the task against the AI router and records real events', async () => {
    requestWorkspaceConversation.mockResolvedValue({ message: 'Billing summary added.', model_used: 'platform-default' })
    const result = await runWorkspaceTask('owner', 'w1', 't1', 'jwt')
    expect(result.ok).toBe(true)
    expect(result.task.status).toBe('done')
    const types = result.task.events.map(event => event.type)
    expect(types).toEqual(['status', 'message', 'message', 'status'])
    expect(result.task.events[2].text).toBe('Billing summary added.')
    expect(requestWorkspaceConversation).toHaveBeenCalledWith('jwt', { workspace_id: 'w1', message: 'Add a billing summary' })
  })

  it('fails honestly when the AI router does not answer', async () => {
    requestWorkspaceConversation.mockResolvedValue(null)
    const result = await runWorkspaceTask('owner', 'w1', 't1', 'jwt')
    expect(result).toMatchObject({ ok: false, status: 503, error: 'ai_router_unavailable' })
    expect(result.task.status).toBe('failed')
    expect(result.task.events.at(-1).type).toBe('error')
  })

  it('refuses to re-run a settled task', async () => {
    appendWorkspaceTaskEvent('owner', 'w1', 't1', { type: 'status', status: 'done' })
    expect(await runWorkspaceTask('owner', 'w1', 't1', 'jwt')).toMatchObject({ ok: false, status: 409 })
    expect(requestWorkspaceConversation).not.toHaveBeenCalled()
  })
})

describe('connector credential handshake', () => {
  it('seals the credential, masks it, and never returns the raw token', () => {
    const secret = 'xoxb-super-secret-token'
    const result = setConnectorCredential('owner', 'w1', 'c1', { token: secret, label: 'Slack bot' })
    expect(result.ok).toBe(true)
    expect(result.credential.label).toBe('Slack bot')
    expect(result.credential.maskedIdentifier).not.toContain('secret')
    expect(JSON.stringify(result)).not.toContain(secret)
    const stored = db.connectorCredentials[0]
    expect(stored.ciphertext).not.toContain(secret)
    expect(db.workspaceConnectors[0]).toMatchObject({ status: 'connected', authMode: 'credential', credentialMasked: stored.maskedIdentifier })
  })

  it('reports credential status and clears it on removal', () => {
    setConnectorCredential('owner', 'w1', 'c1', { token: 'ghp_1234567890abcdef' })
    expect(connectorCredentialStatus('owner', 'w1', 'c1')).toMatchObject({ ok: true, handshake: 'credential', oauthRedirectSupported: false })
    const removed = removeConnectorCredential('owner', 'w1', 'c1')
    expect(removed.ok).toBe(true)
    expect(db.connectorCredentials).toHaveLength(0)
    expect(connectorCredentialStatus('owner', 'w1', 'c1').credential).toBeNull()
    expect(db.workspaceConnectors[0]).toMatchObject({ status: 'disconnected', authMode: null })
  })

  it('rejects short or unknown-target credentials', () => {
    expect(setConnectorCredential('owner', 'w1', 'c1', { token: 'short' })).toMatchObject({ ok: false, status: 400, error: 'credential_too_short' })
    expect(setConnectorCredential('owner', 'w1', 'missing', { token: 'long-enough-token' })).toMatchObject({ ok: false, status: 404 })
    expect(setConnectorCredential('stranger', 'w1', 'c1', { token: 'long-enough-token' })).toMatchObject({ ok: false, status: 404 })
  })
})
