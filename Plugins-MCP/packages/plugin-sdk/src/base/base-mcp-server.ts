/**
 * BaseMCPServer — turns connector capabilities into MCP tools.
 *
 * Guarantees per invoke:
 *   1. tool exists & params satisfy `input_schema` (required keys present)
 *   2. permission check (required role + agent allow-list)
 *   3. destructive tools route through the approval gate
 *   4. handler runs; result is audited and (if trackable) emits a contribution
 *   5. ANY failure becomes a structured `Result` — invoke() never throws.
 *
 * Authors register one handler per tool via `handle(name, fn)`.
 */

import type { ApprovalRequest, ContributionKind } from '@techit/core';
import type { MCPAdapter } from '../contract/mcp-adapter.js';
import {
  type CallContext,
  type MCPTool,
  type Result,
  err,
  ok,
} from '../contract/types.js';
import type { ManifestMCPTool } from '../manifest/schema.js';
import type { SdkRuntime } from '../runtime.js';
import type { WorkspaceCredentialHandle } from '../credentials.js';
import { recordAudit } from '../hooks/audit.js';
import { checkPermission } from '../hooks/permission.js';
import { consumeApproval, requestApproval, validateApproval } from '../hooks/approval.js';
import { emitContribution } from '../hooks/contribution.js';

export type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

interface RegisteredTool {
  spec: ManifestMCPTool;
  handler: ToolHandler;
  contribution?: ContributionKind;
  contributionDetails?: (params: Record<string, unknown>, data: unknown) => {
    projectId?: string;
    artifactId?: string;
    weight?: number;
    metadata?: Record<string, unknown>;
  };
}

export abstract class BaseMCPServer implements MCPAdapter {
  protected ctx!: CallContext;
  private readonly tools = new Map<string, RegisteredTool>();

  constructor(
    protected readonly sourceTool: string,
    protected readonly runtime: SdkRuntime,
    toolSpecs: ManifestMCPTool[],
    /**
     * Workspace-scoped credential handle. When supplied, `bind(ctx)` points it
     * at the acting workspace so real-API resolvers read the CANONICAL lane for
     * that workspace (ADR-1), never a process-wide credential.
     */
    protected readonly creds?: WorkspaceCredentialHandle,
  ) {
    for (const spec of toolSpecs) this.tools.set(spec.name, { spec, handler: notImplemented(spec.name) });
  }

  bind(ctx: CallContext): this {
    this.ctx = ctx;
    this.creds?.use(ctx.resourceWorkspaceId);
    return this;
  }

  /** Register the implementation for a declared tool. */
  protected handle(
    name: string,
    handler: ToolHandler,
    contribution?: ContributionKind,
    contributionDetails?: RegisteredTool['contributionDetails'],
  ): void {
    const existing = this.tools.get(name);
    if (!existing) {
      throw new Error(`tool '${name}' is not declared in the manifest mcp.tools`);
    }
    existing.handler = handler;
    existing.contribution = contribution;
    existing.contributionDetails = contributionDetails;
  }

  describeTools(): MCPTool[] {
    return [...this.tools.values()].map(({ spec }) => ({
      name: spec.name,
      description: spec.description,
      input_schema: spec.input_schema,
      destructive: spec.destructive,
    }));
  }

  async invoke(tool: string, params: unknown): Promise<Result> {
    const entry = this.tools.get(tool);
    if (!entry) {
      return err('not_found', `unknown tool: ${tool}`);
    }

    const validation = validateInput(entry.spec.input_schema, params);
    if (!validation.ok) {
      await recordAudit(this.runtime, this.ctx, this.sourceTool, tool, 'failure', undefined, {
        reason: 'invalid_input',
      });
      return err('invalid_input', 'params do not satisfy input_schema', validation.detail);
    }
    const p = validation.value;

    const qualified = `${this.sourceTool}.${tool}`;
    const decision = checkPermission(this.runtime, this.ctx, qualified, entry.spec.requiredRole);
    if (!decision.allowed) {
      await recordAudit(this.runtime, this.ctx, this.sourceTool, tool, 'denied', undefined, {
        reason: decision.reason,
      });
      return err('permission_denied', 'tool not permitted', decision.detail ?? decision.reason);
    }

    let approvedRequest: ApprovalRequest | undefined;
    if (entry.spec.destructive) {
      const approvalId = typeof p.approvalRequestId === 'string' ? p.approvalRequestId : undefined;
      if (approvalId) {
        const approval = await validateApproval(this.runtime, this.ctx, approvalId, qualified);
        if (!approval.ok) {
          await recordAudit(this.runtime, this.ctx, this.sourceTool, tool, 'denied', undefined, {
            reason: `approval_${approval.reason}`,
            approvalRequestId: approvalId,
          });
          return err('permission_denied', 'approval request is not valid for this execution', approval.reason);
        }
        approvedRequest = approval.request;
      } else {
        const request = await requestApproval(
          this.runtime,
          this.ctx,
          qualified,
          p,
          `destructive MCP tool ${qualified} requires human approval`,
        );
        await recordAudit(this.runtime, this.ctx, this.sourceTool, tool, 'pending_approval', undefined, {
          approvalRequestId: request.id,
        });
        return err('pending_approval', 'awaiting human approval', request.id, request.id);
      }
    }

    try {
      if (approvedRequest) {
        await consumeApproval(this.runtime, approvedRequest, this.ctx.actor.id);
      }
      const data = await entry.handler(p);
      await recordAudit(this.runtime, this.ctx, this.sourceTool, tool, 'success');
      const kind = entry.contribution ?? 'ai_action';
      const details = entry.contributionDetails?.(p, data) ?? {};
      await emitContribution(this.runtime, this.ctx, this.sourceTool, kind, {
        ...details,
        metadata: { tool, ...(details.metadata ?? {}) },
      });
      return ok(data);
    } catch (e) {
      await recordAudit(this.runtime, this.ctx, this.sourceTool, tool, 'failure', undefined, {
        message: (e as Error).message,
      });
      return err('upstream_error', `tool ${tool} failed`, (e as Error).message);
    }
  }
}

function notImplemented(name: string): ToolHandler {
  return async () => {
    throw new Error(`tool '${name}' has no registered handler`);
  };
}

/** Lightweight input_schema check: object shape + declared `required` keys. */
function validateInput(
  schema: Record<string, unknown>,
  params: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false; detail: string } {
  const value = (params ?? {}) as Record<string, unknown>;
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, detail: 'params must be an object' };
  }
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const missing = required.filter((k) => value[k] === undefined);
  if (missing.length > 0) {
    return { ok: false, detail: `missing required: ${missing.join(', ')}` };
  }
  return { ok: true, value };
}
