/**
 * File-backed implementations of AuditLogger, ApprovalStore, ContributionSink.
 *
 * Replaces the InMemory* versions that ship with the SDK so the audit log,
 * approval queue, and execution-intelligence feed survive backend restarts.
 *
 * Storage: a single JSON file (default `backend/data/plugins-mcp.json` —
 * matches the pattern used by BACKEND/main's auth db.json). Override with the
 * `MCP_DATA_FILE` env var.
 *
 * Concurrency model: synchronous write-on-mutation with atomic rename. Safe
 * within a single Node process — write() has no awaits, so each invocation
 * runs to completion before the event loop yields to the next /api/mcp/invoke
 * handler. Verified by tests/file-store-concurrent.test.ts (100 parallel writes
 * land 100 entries; no losses).
 *
 * **Not** safe across multiple processes (cluster mode, multiple replicas
 * behind a load balancer). Two replicas mutating their own in-memory cache
 * will overwrite each other's tmp + rename. Swap for a real datastore behind
 * the same AuditLogger / ApprovalStore / ContributionSink interfaces before
 * scaling horizontally.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import type {
  AuditEntry,
  AuditInput,
  AuditLogger,
} from '@techit/infra-audit';
import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalStore,
  ContributionEvent,
  ContributionSink,
} from '@techit/core';

const DEFAULT_PATH = join(process.cwd(), 'backend', 'data', 'plugins-mcp.json');
const DATA_PATH = process.env.MCP_DATA_FILE || DEFAULT_PATH;
const PRODUCTION_ENVS = new Set(['production', 'staging']);

interface FileShape {
  audit: AuditEntry[];
  approvalRequests: ApprovalRequest[];
  approvalDecisions: Record<string, ApprovalDecision>;
  contributions: ContributionEvent[];
}

let cache: FileShape | undefined;

export function validateMcpStoreConfig(): void {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  if (!PRODUCTION_ENVS.has(env)) return;

  if (!process.env.MCP_DATA_FILE) {
    throw new Error('MCP_DATA_FILE is required in production/staging and must point at persistent storage.');
  }
  throw new Error(
    'File-backed MCP persistence is forbidden in production/staging. Use a transactional shared datastore.',
  );
}

function load(): FileShape {
  if (cache) return cache;
  if (!existsSync(DATA_PATH)) {
    cache = { audit: [], approvalRequests: [], approvalDecisions: {}, contributions: [] };
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as Partial<FileShape>;
    cache = {
      audit: parsed.audit ?? [],
      approvalRequests: parsed.approvalRequests ?? [],
      approvalDecisions: parsed.approvalDecisions ?? {},
      contributions: parsed.contributions ?? [],
    };
  } catch (err) {
    // Corrupt or unreadable file → start fresh rather than crash the service.
    // But ALWAYS log the failure: silent reset hides incidents where the
    // audit trail was wiped (operator needs to know it happened, and what
    // the file looked like at the time so it can be recovered from backup).
    const message = err instanceof Error ? err.message : String(err);
    // Using console.error (not a structured logger) because file-store.ts has
    // no logger dependency. The backend host's stderr is captured by the
    // platform's log aggregator already.
    console.error(
      `[plugins-mcp file-store] failed to parse ${DATA_PATH}: ${message}. ` +
      `Resetting in-memory cache to empty; the on-disk file is preserved ` +
      `but new writes will overwrite it. Recover from backup if the audit ` +
      `trail mattered.`,
    );
    if (PRODUCTION_ENVS.has((process.env.NODE_ENV || '').toLowerCase())) throw err;
    cache = { audit: [], approvalRequests: [], approvalDecisions: {}, contributions: [] };
  }
  return cache;
}

function persist(): void {
  if (!cache) return;
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  const tmp = `${DATA_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache, null, 2));
  renameSync(tmp, DATA_PATH);
}

let auditSeq = 0;

export class FileAuditLogger implements AuditLogger {
  constructor() {
    validateMcpStoreConfig();
    load();
  }

  write(input: AuditInput): AuditEntry {
    const data = load();
    auditSeq += 1;
    const entry: AuditEntry = Object.freeze({
      id: `audit-${Date.now()}-${auditSeq}`,
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
    data.audit.push(entry);
    persist();
    return entry;
  }

  entries(): readonly AuditEntry[] {
    return load().audit.slice();
  }

  entriesForWorkspace(workspaceId: string): readonly AuditEntry[] {
    return load().audit.filter((entry) => entry.workspaceId === workspaceId);
  }
}

export class FileApprovalStore implements ApprovalStore {
  // techit-service.ts inspects `requests.values()` — preserve the Map surface.
  readonly requests = new Map<string, ApprovalRequest>();

  constructor() {
    validateMcpStoreConfig();
    const data = load();
    for (const req of data.approvalRequests) this.requests.set(req.id, req);
  }

  create(request: ApprovalRequest): void {
    const data = load();
    this.requests.set(request.id, request);
    data.approvalRequests = [...this.requests.values()];
    persist();
  }

  decide(decision: ApprovalDecision): void {
    const data = load();
    const req = this.requests.get(decision.requestId);
    if (!req) throw new Error(`unknown approval request: ${decision.requestId}`);
    const updated: ApprovalRequest = { ...req, status: decision.status };
    this.requests.set(req.id, updated);
    data.approvalRequests = [...this.requests.values()];
    data.approvalDecisions[decision.requestId] = decision;
    persist();
  }

  get(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  listForWorkspace(workspaceId: string): ApprovalRequest[] {
    return [...this.requests.values()].filter((req) => req.workspaceId === workspaceId);
  }

  allApprovals(): ApprovalRequest[] {
    return [...this.requests.values()];
  }
}

export class FileContributionSink implements ContributionSink {
  // techit-service.ts spreads `.events` — share the same array as the cache.
  readonly events: ContributionEvent[];

  constructor() {
    validateMcpStoreConfig();
    this.events = load().contributions;
  }

  emit(event: ContributionEvent): void {
    this.events.push(event);
    persist();
  }

  eventsForWorkspace(workspaceId: string): ContributionEvent[] {
    return this.events.filter((event) => event.workspaceId === workspaceId);
  }

  allEvents(): ContributionEvent[] {
    return this.events.slice();
  }
}
