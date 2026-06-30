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
    expect(res.body).toEqual({ ok: true, workspaceId })
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
