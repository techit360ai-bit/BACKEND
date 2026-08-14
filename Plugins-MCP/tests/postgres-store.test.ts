import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import {
  EncryptedPgSecretVault,
  migrateMcpDatabase,
  PgMcpStore,
} from '../server/postgres-store.js';

const databaseUrl = process.env.MCP_TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('PostgreSQL MCP production store', () => {
  let pool: Pool;
  let store: PgMcpStore;

  beforeAll(async () => {
    process.env.MCP_SECRET_KEY ||= Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
    pool = new Pool({ connectionString: databaseUrl, max: 4 });
    await migrateMcpDatabase(pool);
    store = new PgMcpStore(pool);
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE mcp_approval_decisions, mcp_approval_requests, mcp_contributions, mcp_secrets, mcp_audit_log RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('persists tenant-scoped audit and contribution rows', async () => {
    await store.write({
      actor: 'user-1', actorKind: 'human', action: 'search', sourceTool: 'notion',
      result: 'success', workspaceId: 'ws-1', detail: { query: 'roadmap' },
    });
    await store.emit({
      id: 'contrib-1', kind: 'document_update', actorId: 'user-1', actorKind: 'human',
      sourceTool: 'notion', workspaceId: 'ws-1', weight: 1, metadata: {}, timestamp: new Date().toISOString(),
    });
    expect(await store.entriesForWorkspace('ws-1')).toHaveLength(1);
    expect(await store.entriesForWorkspace('ws-2')).toHaveLength(0);
    expect(await store.eventsForWorkspace('ws-1')).toHaveLength(1);
  });

  it('enforces append-only audit rows in PostgreSQL', async () => {
    const row = await store.write({
      actor: 'user-1', actorKind: 'human', action: 'read', sourceTool: 'figma',
      result: 'success', workspaceId: 'ws-1',
    });
    await expect(pool.query('DELETE FROM mcp_audit_log WHERE id = $1', [row.id])).rejects.toThrow(/append-only/);
  });

  it('allows an approved request to be consumed only once across replicas', async () => {
    await store.create({
      id: 'approval-1', workspaceId: 'ws-1', requestedBy: 'agent-1', action: 'figma.post_comment',
      params: { message: 'ship it' }, reason: 'destructive', status: 'pending', createdAt: new Date().toISOString(),
    });
    await store.decide({ requestId: 'approval-1', decidedBy: 'owner-1', status: 'approved', decidedAt: new Date().toISOString() });
    const results = await Promise.allSettled([
      store.decide({ requestId: 'approval-1', decidedBy: 'agent-1', status: 'used', decidedAt: new Date().toISOString() }),
      store.decide({ requestId: 'approval-1', decidedBy: 'agent-2', status: 'used', decidedAt: new Date().toISOString() }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await store.get('approval-1'))?.status).toBe('used');
  });

  it('stores secrets as AES-GCM ciphertext and decrypts them after restart', async () => {
    const firstVault = new EncryptedPgSecretVault(pool);
    await firstVault.scopeTo('notion').set('access_token', 'secret-production-token');
    const raw = await pool.query('SELECT ciphertext, iv, auth_tag FROM mcp_secrets WHERE namespace=$1 AND key_name=$2', [
      'secrets://notion/', 'access_token',
    ]);
    expect(raw.rowCount).toBe(1);
    expect(Buffer.from(raw.rows[0].ciphertext).toString('utf8')).not.toContain('secret-production-token');
    expect(Buffer.from(raw.rows[0].iv)).toHaveLength(12);
    expect(Buffer.from(raw.rows[0].auth_tag)).toHaveLength(16);
    const restartedVault = new EncryptedPgSecretVault(pool);
    expect((await restartedVault.scopeTo('notion').get('access_token'))?.value).toBe('secret-production-token');
  });
});
