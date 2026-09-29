import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app, { mcpRoleFromClaim } from '../app.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

function token({ sub = 'user-1', role = 'founder', workspaceId = `ws-${Date.now()}`, kind, toolsAllowed } = {}) {
  return jwt.sign({ sub, role, workspaceId, kind, toolsAllowed }, TEST_SECRET, { expiresIn: '1h' })
}

function auth(value) {
  return { Authorization: `Bearer ${value}` }
}

describe('MCP role mapping', () => {
  it('maps platform organization spellings to MCP owner permissions', () => {
    expect(mcpRoleFromClaim('organisation')).toBe('owner')
    expect(mcpRoleFromClaim('organization')).toBe('owner')
  })
})

describe('/api/mcp authenticated integration', () => {
  it('requires a bearer token', async () => {
    const res = await request(app).get('/api/mcp/tools')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('unauthenticated')
  })

  it('scopes health to the authenticated workspace claim', async () => {
    const workspaceId = `ws-health-${Date.now()}`
    const res = await request(app)
      .get('/api/mcp/health')
      .set(auth(token({ workspaceId })))

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.workspaceId).toBe(workspaceId)
    // /health also echoes the actor the server actually resolved, so the
    // dashboard can show real authority instead of a client-chosen role that
    // resolveActor would overwrite.
    expect(res.body.actor).toMatchObject({ kind: 'human' })
    expect(typeof res.body.actor.id).toBe('string')
    expect(typeof res.body.actor.role).toBe('string')
  })

  it('enforces approval workspace isolation, role authorization, and single-use execution', async () => {
    const workspaceId = `ws-mcp-${Date.now()}`
    const otherWorkspaceId = `${workspaceId}-other`
    const ownerToken = token({ sub: 'owner-1', role: 'founder', workspaceId })
    const viewerToken = token({ sub: 'viewer-1', role: 'investor', workspaceId })
    const otherOwnerToken = token({ sub: 'owner-2', role: 'founder', workspaceId: otherWorkspaceId })
    const params = { repo: 'havitec/techit', head: 'feat/mcp', base: 'main', title: 'MCP gate' }

    const pending = await request(app)
      .post('/api/mcp/invoke')
      .set(auth(ownerToken))
      .send({ plugin: 'github', tool: 'create_pull_request', params })

    expect(pending.status).toBe(200)
    expect(pending.body.ok).toBe(false)
    expect(pending.body.error.code).toBe('pending_approval')
    const approvalRequestId = pending.body.approvalRequestId
    expect(approvalRequestId).toBeTruthy()

    const sameWorkspaceApprovals = await request(app)
      .get('/api/mcp/approvals')
      .set(auth(ownerToken))
    expect(sameWorkspaceApprovals.status).toBe(200)
    expect(sameWorkspaceApprovals.body.some((req) => req.id === approvalRequestId)).toBe(true)

    const otherWorkspaceApprovals = await request(app)
      .get('/api/mcp/approvals')
      .set(auth(otherOwnerToken))
    expect(otherWorkspaceApprovals.status).toBe(200)
    expect(otherWorkspaceApprovals.body.some((req) => req.id === approvalRequestId)).toBe(false)

    const viewerDecision = await request(app)
      .post(`/api/mcp/approvals/${approvalRequestId}/approve`)
      .set(auth(viewerToken))
    expect(viewerDecision.status).toBe(403)
    expect(viewerDecision.body.reason).toBe('insufficient_role')

    const otherWorkspaceDecision = await request(app)
      .post(`/api/mcp/approvals/${approvalRequestId}/approve`)
      .set(auth(otherOwnerToken))
    expect(otherWorkspaceDecision.status).toBe(403)
    expect(otherWorkspaceDecision.body.reason).toBe('workspace_mismatch')

    const approved = await request(app)
      .post(`/api/mcp/approvals/${approvalRequestId}/approve`)
      .set(auth(ownerToken))
    expect(approved.status).toBe(200)
    expect(approved.body).toEqual({ approved: true })

    const executed = await request(app)
      .post('/api/mcp/invoke')
      .set(auth(ownerToken))
      .send({
        plugin: 'github',
        tool: 'create_pull_request',
        params: { ...params, approvalRequestId },
      })
    expect(executed.status).toBe(200)
    expect(executed.body.ok).toBe(true)

    const replay = await request(app)
      .post('/api/mcp/invoke')
      .set(auth(ownerToken))
      .send({
        plugin: 'github',
        tool: 'create_pull_request',
        params: { ...params, approvalRequestId },
      })
    expect(replay.status).toBe(200)
    expect(replay.body.ok).toBe(false)
    expect(replay.body.error.code).toBe('permission_denied')
    expect(replay.body.error.detail).toBe('used')
  })

  it('allows organization-spelled platform owners to approve MCP actions', async () => {
    const workspaceId = `ws-org-${Date.now()}`
    const organizationToken = token({ sub: 'org-1', role: 'organization', workspaceId })
    const params = { repo: 'havitec/techit', head: 'feat/org-mcp', base: 'main', title: 'Org MCP gate' }

    const pending = await request(app)
      .post('/api/mcp/invoke')
      .set(auth(organizationToken))
      .send({ plugin: 'github', tool: 'create_pull_request', params })

    expect(pending.status).toBe(200)
    expect(pending.body.ok).toBe(false)
    expect(pending.body.error.code).toBe('pending_approval')
    const approvalRequestId = pending.body.approvalRequestId
    expect(approvalRequestId).toBeTruthy()

    const approved = await request(app)
      .post(`/api/mcp/approvals/${approvalRequestId}/approve`)
      .set(auth(organizationToken))

    expect(approved.status).toBe(200)
    expect(approved.body).toEqual({ approved: true })
  })
})

describe('/api/mcp connector credentials', () => {
  it('requires a bearer token to read connections', async () => {
    const res = await request(app).get('/api/mcp/connections')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('unauthenticated')
  })

  it('never returns secret material on the connections list', async () => {
    const res = await request(app)
      .get('/api/mcp/connections')
      .set(auth(token({ workspaceId: `ws-conn-${Date.now()}` })))

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(7)
    for (const connection of res.body) {
      expect(connection).toMatchObject({
        plugin: expect.any(String),
        connected: expect.any(Boolean),
        mode: expect.any(String),
      })
      // The value must never be echoed — only presence, expiry and provenance.
      expect(connection).not.toHaveProperty('credential')
      expect(connection).not.toHaveProperty('value')
      expect(connection).not.toHaveProperty('accessToken')
    }
  })

  it('refuses credential management to a non-operator role', async () => {
    const viewerToken = token({ sub: 'viewer-2', role: 'investor', workspaceId: `ws-conn-v-${Date.now()}` })

    const created = await request(app)
      .post('/api/mcp/connections/web3')
      .set(auth(viewerToken))
      .send({ credential: 'https://sepolia.example/rpc' })
    expect(created.status).toBe(403)
    expect(created.body.error.code).toBe('permission_denied')

    const removed = await request(app)
      .delete('/api/mcp/connections/web3')
      .set(auth(viewerToken))
    expect(removed.status).toBe(403)
    expect(removed.body.error.code).toBe('permission_denied')
  })

  it('rejects an unknown connector and an empty credential', async () => {
    const ownerToken = token({ sub: 'owner-3', role: 'founder', workspaceId: `ws-conn-b-${Date.now()}` })

    const unknown = await request(app)
      .post('/api/mcp/connections/not-a-connector')
      .set(auth(ownerToken))
      .send({ credential: 'x' })
    expect(unknown.status).toBe(404)
    expect(unknown.body.error).toBe('unknown_connector')

    const blank = await request(app)
      .post('/api/mcp/connections/web3')
      .set(auth(ownerToken))
      .send({ credential: '   ' })
    expect(blank.status).toBe(400)
    expect(blank.body.error).toBe('credential_required')

    // A stored credential would be unusable if the URL were not a URL.
    const badUrl = await request(app)
      .post('/api/mcp/connections/web3')
      .set(auth(ownerToken))
      .send({ credential: 'not a url' })
    expect(badUrl.status).toBe(400)
    expect(badUrl.body.error).toBe('rpc_url_invalid')
  })

  it('connects and disconnects a credential end to end', async () => {
    const ownerToken = token({ sub: 'owner-4', role: 'founder', workspaceId: `ws-conn-e2e-${Date.now()}` })

    const connected = await request(app)
      .post('/api/mcp/connections/web3')
      .set(auth(ownerToken))
      .send({ credential: 'https://sepolia.example/rpc' })

    expect(connected.status).toBe(200)
    expect(connected.body.ok).toBe(true)
    expect(connected.body.connection).toMatchObject({
      plugin: 'web3',
      connected: true,
      source: 'vault',
      kind: 'rpc_url',
    })
    // No explicit TTL means the credential does not expire — see the
    // InMemorySecretVault default, which now matches the Postgres vault.
    expect(connected.body.connection.expiresAt).toBe('9999-12-31T23:59:59.999Z')

    const listed = await request(app)
      .get('/api/mcp/connections')
      .set(auth(ownerToken))
    const web3 = listed.body.find((c) => c.plugin === 'web3')
    expect(web3.connected).toBe(true)

    const disconnected = await request(app)
      .delete('/api/mcp/connections/web3')
      .set(auth(ownerToken))

    expect(disconnected.status).toBe(200)
    expect(disconnected.body.ok).toBe(true)
    expect(disconnected.body.removed).toBe(true)

    const after = await request(app)
      .get('/api/mcp/connections')
      .set(auth(ownerToken))
    const web3After = after.body.find((c) => c.plugin === 'web3')
    expect(web3After.connected).toBe(false)
    expect(web3After.source).toBe('none')
  })
})
