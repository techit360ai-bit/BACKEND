import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalStore,
  ContributionEvent,
  ContributionSink,
} from '@techit/core';
import type { AuditEntry, AuditInput, AuditLogger } from '@techit/infra-audit';
import type { ScopedSecrets, SecretLease, SecretVault } from '@techit/infra-secrets';
import { NEVER_EXPIRES, vaultNamespace } from '@techit/infra-secrets';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

const MIGRATION_PATH = fileURLToPath(new URL('../migrations/001_mcp_production.sql', import.meta.url));

function productionLike(): boolean {
  return ['production', 'staging'].includes((process.env.NODE_ENV || '').toLowerCase());
}

export function mcpDatabaseUrl(): string | undefined {
  return process.env.MCP_DATABASE_URL || process.env.DATABASE_URL;
}

export function validatePostgresMcpConfig(): void {
  const url = mcpDatabaseUrl();
  if (!url) throw new Error('MCP_DATABASE_URL (or DATABASE_URL) is required when MCP_STORE=postgres.');
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('MCP_DATABASE_URL must use postgres:// or postgresql://.');
  }
  if (productionLike() && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error('MCP_DATABASE_URL cannot target localhost in production/staging.');
  }
  parseKey(process.env.MCP_SECRET_KEY || '', 'MCP_SECRET_KEY');
}

export function createMcpPool(): Pool {
  validatePostgresMcpConfig();
  const config: PoolConfig = {
    connectionString: mcpDatabaseUrl(),
    max: Number(process.env.MCP_DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.MCP_DATABASE_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.MCP_DATABASE_CONNECT_TIMEOUT_MS || 10_000),
    application_name: 'techit-plugins-mcp',
  };
  const sslEnabled = process.env.MCP_DATABASE_SSL === 'true' ||
    (productionLike() && process.env.MCP_DATABASE_SSL !== 'false');
  if (sslEnabled) {
    config.ssl = { rejectUnauthorized: process.env.MCP_DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };
  }
  return new Pool(config);
}

export async function migrateMcpDatabase(pool: Pool): Promise<void> {
  const sql = await readFile(MIGRATION_PATH, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('techit-mcp-schema'))");
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class PgMcpStore implements AuditLogger, ApprovalStore, ContributionSink {
  constructor(readonly pool: Pool) {}

  async healthCheck(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async write(input: AuditInput): Promise<AuditEntry> {
    const entry: AuditEntry = Object.freeze({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      actor: input.actor,
      actorKind: input.actorKind,
      action: input.action,
      sourceTool: input.sourceTool,
      resource: input.resource,
      result: input.result,
      workspaceId: input.workspaceId,
      detail: input.detail,
    });
    await this.pool.query(
      `INSERT INTO mcp_audit_log
       (id, timestamp, actor, actor_kind, action, source_tool, resource, result, workspace_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [entry.id, entry.timestamp, entry.actor, entry.actorKind, entry.action, entry.sourceTool,
        entry.resource ?? null, entry.result, entry.workspaceId, entry.detail ?? null],
    );
    return entry;
  }

  async entries(): Promise<readonly AuditEntry[]> {
    return this.auditQuery();
  }

  async entriesForWorkspace(workspaceId: string): Promise<readonly AuditEntry[]> {
    return this.auditQuery(workspaceId);
  }

  private async auditQuery(workspaceId?: string): Promise<AuditEntry[]> {
    const result = await this.pool.query(
      `SELECT id, timestamp, actor, actor_kind, action, source_tool, resource, result, workspace_id, detail
       FROM mcp_audit_log
       ${workspaceId ? 'WHERE workspace_id = $1' : ''}
       ORDER BY timestamp ASC, id ASC`,
      workspaceId ? [workspaceId] : [],
    );
    return result.rows.map((row) => ({
      id: String(row.id), timestamp: iso(row.timestamp), actor: String(row.actor),
      actorKind: row.actor_kind, action: String(row.action), sourceTool: String(row.source_tool),
      resource: row.resource ?? undefined, result: row.result, workspaceId: String(row.workspace_id),
      detail: row.detail ?? undefined,
    }));
  }

  async create(request: ApprovalRequest): Promise<void> {
    await this.pool.query(
      `INSERT INTO mcp_approval_requests
       (id, workspace_id, requested_by, action, params, reason, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [request.id, request.workspaceId, request.requestedBy, request.action, request.params,
        request.reason, request.status, request.createdAt],
    );
  }

  async decide(decision: ApprovalDecision): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        'SELECT status FROM mcp_approval_requests WHERE id = $1 FOR UPDATE',
        [decision.requestId],
      );
      if (current.rowCount !== 1) throw new Error(`unknown approval request: ${decision.requestId}`);
      const status = String(current.rows[0].status);
      const allowed = (status === 'pending' && ['approved', 'rejected'].includes(decision.status)) ||
        (status === 'approved' && decision.status === 'used');
      if (!allowed) {
        throw new Error(`invalid approval transition: ${status} -> ${decision.status}`);
      }
      await client.query(
        'UPDATE mcp_approval_requests SET status = $2 WHERE id = $1',
        [decision.requestId, decision.status],
      );
      await client.query(
        `INSERT INTO mcp_approval_decisions
         (request_id, decided_by, status, decided_at, comment) VALUES ($1,$2,$3,$4,$5)`,
        [decision.requestId, decision.decidedBy, decision.status, decision.decidedAt, decision.comment ?? null],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async get(requestId: string): Promise<ApprovalRequest | undefined> {
    const result = await this.pool.query(
      `SELECT id, workspace_id, requested_by, action, params, reason, status, created_at
       FROM mcp_approval_requests WHERE id = $1`,
      [requestId],
    );
    return result.rowCount === 1 ? approvalFromRow(result.rows[0]) : undefined;
  }

  async listForWorkspace(workspaceId: string): Promise<ApprovalRequest[]> {
    const result = await this.pool.query(
      `SELECT id, workspace_id, requested_by, action, params, reason, status, created_at
       FROM mcp_approval_requests WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId],
    );
    return result.rows.map(approvalFromRow);
  }

  async allApprovals(): Promise<ApprovalRequest[]> {
    const result = await this.pool.query(
      `SELECT id, workspace_id, requested_by, action, params, reason, status, created_at
       FROM mcp_approval_requests ORDER BY created_at DESC`,
    );
    return result.rows.map(approvalFromRow);
  }

  async emit(event: ContributionEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO mcp_contributions
       (id, kind, actor_id, actor_kind, source_tool, workspace_id, project_id, artifact_id, weight, metadata, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [event.id, event.kind, event.actorId, event.actorKind, event.sourceTool, event.workspaceId,
        event.projectId ?? null, event.artifactId ?? null, event.weight, event.metadata, event.timestamp],
    );
  }

  async eventsForWorkspace(workspaceId: string): Promise<ContributionEvent[]> {
    return this.contributionQuery(workspaceId);
  }

  async allEvents(): Promise<ContributionEvent[]> {
    return this.contributionQuery();
  }

  private async contributionQuery(workspaceId?: string): Promise<ContributionEvent[]> {
    const result = await this.pool.query(
      `SELECT id, kind, actor_id, actor_kind, source_tool, workspace_id, project_id,
              artifact_id, weight, metadata, timestamp
       FROM mcp_contributions ${workspaceId ? 'WHERE workspace_id = $1' : ''}
       ORDER BY timestamp ASC, id ASC`,
      workspaceId ? [workspaceId] : [],
    );
    return result.rows.map((row) => ({
      id: String(row.id), kind: row.kind, actorId: String(row.actor_id), actorKind: row.actor_kind,
      sourceTool: String(row.source_tool), workspaceId: String(row.workspace_id),
      projectId: row.project_id ?? undefined, artifactId: row.artifact_id ?? undefined,
      weight: Number(row.weight), metadata: row.metadata ?? {}, timestamp: iso(row.timestamp),
    }));
  }
}

function approvalFromRow(row: Record<string, unknown>): ApprovalRequest {
  return {
    id: String(row.id), workspaceId: String(row.workspace_id), requestedBy: String(row.requested_by),
    action: String(row.action), params: row.params, reason: String(row.reason),
    status: row.status as ApprovalRequest['status'], createdAt: iso(row.created_at as Date | string),
  };
}

interface EncryptionKey {
  id: string;
  value: Buffer;
}

function parseKey(raw: string, name: string): EncryptionKey {
  let value: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) value = Buffer.from(raw, 'hex');
  else {
    try { value = Buffer.from(raw, 'base64'); } catch { value = Buffer.alloc(0); }
  }
  if (value.length !== 32) {
    throw new Error(`${name} must be a base64-encoded or 64-character hex 32-byte key.`);
  }
  if (new Set(value).size < 8 || /change|replace|test|secret/i.test(raw)) {
    throw new Error(`${name} must be a high-entropy non-placeholder key.`);
  }
  return { id: createHash('sha256').update(value).digest('hex').slice(0, 16), value };
}

export class EncryptedPgSecretVault implements SecretVault {
  private readonly primary: EncryptionKey;
  private readonly keys: Map<string, EncryptionKey>;

  constructor(private readonly pool: Pool) {
    this.primary = parseKey(process.env.MCP_SECRET_KEY || '', 'MCP_SECRET_KEY');
    const previous = (process.env.MCP_SECRET_KEY_PREVIOUS || '').split(',').map((x) => x.trim()).filter(Boolean)
      .map((raw, index) => parseKey(raw, `MCP_SECRET_KEY_PREVIOUS[${index}]`));
    this.keys = new Map([this.primary, ...previous].map((key) => [key.id, key]));
  }

  scopeTo(plugin: string, owner?: string): ScopedSecrets {
    const namespace = vaultNamespace(plugin, owner);
    return {
      namespace,
      get: (key) => this.get(namespace, key),
      set: (key, value, ttlSeconds = 0) => this.set(namespace, key, value, ttlSeconds),
      rotate: async (key, value, ttlSeconds = 0) => {
        await this.set(namespace, key, value, ttlSeconds);
        return { value, expiresAt: expiry(ttlSeconds) };
      },
      delete: (key) => this.remove(namespace, key),
    };
  }

  /** Remove a stored secret. Returns true when a row was actually deleted. */
  private async remove(namespace: string, key: string): Promise<boolean> {
    validateSecretKey(key);
    const result = await this.pool.query(
      'DELETE FROM mcp_secrets WHERE namespace = $1 AND key_name = $2',
      [namespace, key],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async get(namespace: string, key: string): Promise<SecretLease | undefined> {
    validateSecretKey(key);
    const result = await this.pool.query(
      `SELECT ciphertext, iv, auth_tag, key_id, expires_at FROM mcp_secrets
       WHERE namespace = $1 AND key_name = $2`,
      [namespace, key],
    );
    if (result.rowCount !== 1) return undefined;
    const row = result.rows[0];
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      await this.remove(namespace, key);
      return undefined;
    }
    const encryptionKey = this.keys.get(String(row.key_id));
    if (!encryptionKey) throw new Error(`No MCP secret decryption key is configured for key id ${row.key_id}.`);
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey.value, row.iv);
    decipher.setAAD(Buffer.from(`${namespace}${key}`, 'utf8'));
    decipher.setAuthTag(row.auth_tag);
    const value = Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString('utf8');
    const expiresAt = row.expires_at ? iso(row.expires_at) : NEVER_EXPIRES;
    if (encryptionKey.id !== this.primary.id) await this.set(namespace, key, value, ttlRemaining(row.expires_at));
    return { value, expiresAt };
  }

  private async set(namespace: string, key: string, value: string, ttlSeconds: number): Promise<void> {
    validateSecretKey(key);
    if (!value) throw new Error(`refusing to persist empty MCP secret ${namespace}${key}`);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.primary.value, iv);
    cipher.setAAD(Buffer.from(`${namespace}${key}`, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const expiresAt = ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000) : null;
    await this.pool.query(
      `INSERT INTO mcp_secrets
       (namespace, key_name, ciphertext, iv, auth_tag, key_id, expires_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (namespace, key_name) DO UPDATE SET
         ciphertext=EXCLUDED.ciphertext, iv=EXCLUDED.iv, auth_tag=EXCLUDED.auth_tag,
         key_id=EXCLUDED.key_id, expires_at=EXCLUDED.expires_at, updated_at=NOW()`,
      [namespace, key, ciphertext, iv, authTag, this.primary.id, expiresAt],
    );
  }
}

function validateSecretKey(key: string): void {
  if (!key || key.includes('/') || key.length > 200) throw new Error(`invalid MCP secret key: ${key}`);
}

function expiry(ttlSeconds: number): string {
  return ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : NEVER_EXPIRES;
}

function ttlRemaining(expiresAt: Date | string | null): number {
  if (!expiresAt) return 0;
  return Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export async function withMcpTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await run(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
