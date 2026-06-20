/**
 * infra/audit — immutable, append-only audit log.
 *
 * Every connector read/write/execute and every MCP invoke writes one entry.
 * Entries are frozen on write; the AuditLog exposes no mutation/removal API,
 * satisfying the "audit logs are immutable" requirement.
 */

export type AuditResult = 'success' | 'failure' | 'pending_approval' | 'denied';

export interface AuditEntry {
  readonly id: string;
  readonly timestamp: string;
  /** Acting principal id (human or agent). */
  readonly actor: string;
  readonly actorKind: 'human' | 'agent';
  /** Fully-qualified action, e.g. 'github.create_pull_request' or 'readResource'. */
  readonly action: string;
  /** Plugin/connector that handled the action. */
  readonly sourceTool: string;
  /** Target resource id, if any. */
  readonly resource?: string;
  readonly result: AuditResult;
  readonly workspaceId: string;
  readonly detail?: Record<string, unknown>;
}

export interface AuditInput {
  actor: string;
  actorKind: 'human' | 'agent';
  action: string;
  sourceTool: string;
  resource?: string;
  result: AuditResult;
  workspaceId: string;
  detail?: Record<string, unknown>;
}

export interface AuditLogger {
  write(input: AuditInput): AuditEntry;
  /** Read-only view for verification/queries. */
  entries(): readonly AuditEntry[];
}

let auditSeq = 0;

/**
 * In-memory append-only logger. Production swaps this for a WORM store
 * (e.g. an append-only table or object-lock bucket) behind the same interface.
 */
export class InMemoryAuditLogger implements AuditLogger {
  private readonly log: AuditEntry[] = [];

  write(input: AuditInput): AuditEntry {
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
    this.log.push(entry);
    return entry;
  }

  entries(): readonly AuditEntry[] {
    return this.log.slice();
  }
}
