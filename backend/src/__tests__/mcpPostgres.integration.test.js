// End-to-end check of the Plugins-MCP boundary on the production driver.
//
// Production runs DB_DRIVER=postgres. The MCP actor resolver used to read the
// synchronous authority snapshot, which throws there, so every authenticated
// MCP request was answered 401 "Missing or invalid token".
//
// Run with: PLATFORM_TEST_DATABASE_URL=postgres://user:pass@host:port/db npx vitest run mcpPostgres
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

const url = vi.hoisted(() => {
  const value = process.env.PLATFORM_TEST_DATABASE_URL
  if (value) {
    Object.assign(process.env, {
      DB_DRIVER: 'postgres',
      PLATFORM_DATABASE_URL: value,
      DATABASE_URL: value,
      IDENTITY_DATABASE_URL: value,
      IDENTITY_READ_SOURCE: 'postgres',
      IDENTITY_WRITE_SOURCE: 'postgres',
      IDENTITY_READ_FALLBACK_SQLITE: 'false',
    })
  }
  return value
})

describe.skipIf(!url)('MCP actor resolution on PostgreSQL', () => {
  let app
  let request
  let jwt
  let platform

  beforeAll(async () => {
    platform = await import('../repositories/platformCollectionRepository.js')
    const pool = platform.getPlatformPool()
    for (const file of ['009_core_identity_projection.sql', '014_platform_collection_records.sql']) {
      await pool.query(fs.readFileSync(new URL(`../../migrations/postgres/${file}`, import.meta.url), 'utf8'))
    }
    await pool.query("DELETE FROM core_users WHERE id='mcp-pg-user'")
    await pool.query("DELETE FROM platform_collection_records WHERE record_id IN ('ws-profile','proj-mcp','integration-1','membership-1')")
    const now = new Date().toISOString()
    await pool.query('INSERT INTO core_users(id,email,password_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$4)', ['mcp-pg-user', 'mcp-pg@example.com', 'x', now])
    await pool.query('INSERT INTO core_profiles(id,email,role,workspace_id,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6)', ['mcp-pg-user', 'mcp-pg@example.com', 'founder', 'ws-profile', JSON.stringify({ id: 'mcp-pg-user', role: 'founder', workspaceId: 'ws-profile' }), now])
    await platform.withPlatformTransaction(async client => {
      await platform.upsertRecord(client, 'workspaces', { id: 'ws-profile', projectId: 'proj-mcp', ownerId: 'mcp-pg-user', createdAt: now, updatedAt: now }, { operation: 'insert' })
      await platform.upsertRecord(client, 'projects', { id: 'proj-mcp', ownerId: 'mcp-pg-user', stage: 'mvp', createdAt: now, updatedAt: now }, { operation: 'insert' })
      await platform.upsertRecord(client, 'organizationIntegrations', { id: 'integration-1', organizationId: 'org-1', pluginName: 'github', resourceKind: 'software', accessPolicy: 'organization', createdAt: now, updatedAt: now }, { operation: 'insert' })
    })
    ;({ default: app } = await import('../app.js'))
    ;({ default: request } = await import('supertest'))
    ;({ default: jwt } = await import('jsonwebtoken'))
  })

  afterAll(async () => { await platform?.closePlatformPool?.() })

  const bearer = claims => ({ Authorization: `Bearer ${jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: '1h' })}` })

  it('resolves an authenticated actor from the identity store instead of answering 401', async () => {
    const res = await request(app).get('/api/mcp/health').set(bearer({ sub: 'mcp-pg-user', role: 'founder', workspaceId: 'ws-claimed-by-client' }))
    expect(res.status).toBe(200)
    // The persisted profile workspace wins over a client-chosen claim.
    expect(res.body.workspaceId).toBe('ws-profile')
    expect(res.body.actor).toMatchObject({ id: 'mcp-pg-user', kind: 'human' })
  })

  it('still rejects an invalid token', async () => {
    const res = await request(app).get('/api/mcp/health').set({ Authorization: 'Bearer not-a-token' })
    expect(res.status).toBe(401)
  })

  it('loads the scoped bundle the invocation policy needs and persists projected rows', async () => {
    const { withMcpAuthority } = await import('../repositories/mcpAuthorityRepository.js')
    const { readAuthorityDb, updateAuthorityDb } = await import('../config/database.js')
    const { organizationResourceAccess } = await import('../services/organizationResourcePolicy.js')
    expect(() => readAuthorityDb()).toThrow(/request authority context is required/)
    const decision = await withMcpAuthority({ userId: 'mcp-pg-user', workspaceId: 'ws-profile', integrationId: 'integration-1' }, () => {
      const db = readAuthorityDb()
      expect(db.projects.map(row => row.id)).toEqual(['proj-mcp'])
      return organizationResourceAccess(db, 'mcp-pg-user', db.organizationIntegrations[0])
    })
    // Not a member of org-1: the organization policy denies access.
    expect(decision).toMatchObject({ allowed: false, reason: 'organization_membership_required' })
    await withMcpAuthority({ userId: 'mcp-pg-user', workspaceId: 'ws-profile' }, () => updateAuthorityDb(db => {
      db.organizationActivityEvents.push({ id: 'evidence-mcp-1', organizationId: 'org-1', type: 'software_contribution', createdAt: new Date().toISOString() })
    }), { write: true })
    const stored = await platform.getPlatformPool().query("SELECT count(*)::int AS n FROM platform_collection_records WHERE collection_name='organizationActivityEvents' AND record_id='evidence-mcp-1'")
    expect(stored.rows[0].n).toBe(1)
  })
})
