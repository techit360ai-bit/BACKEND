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
 * Concurrency model: synchronous write-on-mutation with atomic rename. Fine
 * for the current single-process Node service; if/when the backend scales
 * horizontally, swap these for a real datastore behind the same interfaces.
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

interface FileShape {
  audit: AuditEntry[];
  approvalRequests: ApprovalRequest[];
  approvalDecisions: Record<string, ApprovalDecision>;
  contributions: ContributionEvent[];
}

let cache: FileShape | undefined;

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
  } catch {
    // Corrupt or unreadable file → start fresh rather than crash the service.
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
}

export class FileApprovalStore implements ApprovalStore {
  // techit-service.ts inspects `requests.values()` — preserve the Map surface.
  readonly requests = new Map<string, ApprovalRequest>();

  constructor() {
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
}

export class FileContributionSink implements ContributionSink {
  // techit-service.ts spreads `.events` — share the same array as the cache.
  readonly events: ContributionEvent[];

  constructor() {
    this.events = load().contributions;
  }

  emit(event: ContributionEvent): void {
    this.events.push(event);
    persist();
  }
}
