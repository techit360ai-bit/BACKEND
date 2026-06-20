/**
 * BaseConnector — wraps every read/write/execute with the mandatory plumbing:
 *   permission check → (approval gate for destructive) → impl → audit → contribution.
 *
 * Authors override the protected `*Impl` methods only. They cannot skip a gate,
 * because the public Connector methods are `final` here and always run the wrapper.
 *
 * Context: the connector is bound to a CallContext per request via `bind(ctx)`
 * (the MCP client does this on every invoke). Until bound it uses a system ctx.
 */

import type { ContributionKind, Role } from '@techit/core';
import type { Connector } from '../contract/connector.js';
import {
  type AuthToken,
  type CallContext,
  type Resource,
  type Result,
  err,
  ok,
} from '../contract/types.js';
import type { SdkRuntime } from '../runtime.js';
import { recordAudit } from '../hooks/audit.js';
import { checkPermission } from '../hooks/permission.js';
import { requestApproval } from '../hooks/approval.js';
import { emitContribution } from '../hooks/contribution.js';

export interface ActionPolicy {
  requiredRole: Role;
  destructive: boolean;
  contribution?: ContributionKind;
}

export abstract class BaseConnector implements Connector {
  protected ctx!: CallContext;

  constructor(
    protected readonly sourceTool: string,
    protected readonly runtime: SdkRuntime,
  ) {}

  /** Bind the acting context for the next call(s). Returns `this` for chaining. */
  bind(ctx: CallContext): this {
    this.ctx = ctx;
    return this;
  }

  // ---- public Connector surface (do not override) ----

  async authenticate(): Promise<AuthToken> {
    return this.authenticateImpl();
  }

  async listResources(): Promise<Resource[]> {
    const decision = checkPermission(this.runtime, this.ctx, `${this.sourceTool}.listResources`, 'viewer');
    if (!decision.allowed) {
      recordAudit(this.runtime, this.ctx, this.sourceTool, 'listResources', 'denied', undefined, {
        reason: decision.reason,
      });
      throw new Error(`permission_denied: ${decision.detail ?? decision.reason}`);
    }
    const out = await this.listResourcesImpl();
    recordAudit(this.runtime, this.ctx, this.sourceTool, 'listResources', 'success');
    return out;
  }

  async readResource(id: string): Promise<Resource> {
    const decision = checkPermission(this.runtime, this.ctx, `${this.sourceTool}.readResource`, 'viewer');
    if (!decision.allowed) {
      recordAudit(this.runtime, this.ctx, this.sourceTool, 'readResource', 'denied', id, {
        reason: decision.reason,
      });
      throw new Error(`permission_denied: ${decision.detail ?? decision.reason}`);
    }
    const out = await this.readResourceImpl(id);
    recordAudit(this.runtime, this.ctx, this.sourceTool, 'readResource', 'success', id);
    return out;
  }

  async writeResource(id: string, payload: unknown): Promise<void> {
    const res = await this.runGuarded(
      'writeResource',
      `${this.sourceTool}.writeResource`,
      { requiredRole: 'editor', destructive: true, contribution: 'document_update' },
      { id, payload },
      async () => {
        await this.writeResourceImpl(id, payload);
        return undefined;
      },
    );
    if (!res.ok) {
      throw new Error(`${res.error.code}: ${res.error.detail ?? res.error.error}`);
    }
  }

  async executeAction(action: string, params: unknown): Promise<Result> {
    const policy = this.policyFor(action);
    return this.runGuarded(
      action,
      `${this.sourceTool}.${action}`,
      policy,
      params,
      () => this.executeActionImpl(action, params),
    );
  }

  /**
   * Shared guard: permission → approval (if destructive & not yet approved) →
   * impl → audit → contribution. Returns a structured Result and never lets an
   * impl error escape unstructured.
   */
  protected async runGuarded<T>(
    auditAction: string,
    qualifiedAction: string,
    policy: ActionPolicy,
    params: unknown,
    run: () => Promise<T>,
  ): Promise<Result<T>> {
    const decision = checkPermission(this.runtime, this.ctx, qualifiedAction, policy.requiredRole);
    if (!decision.allowed) {
      recordAudit(this.runtime, this.ctx, this.sourceTool, auditAction, 'denied', undefined, {
        reason: decision.reason,
      });
      return err('permission_denied', 'action not permitted', decision.detail ?? decision.reason);
    }

    if (policy.destructive) {
      const approvalId = this.approvalIdFor(params);
      const approved = approvalId
        ? (await this.runtime.approvals.get(approvalId))?.status === 'approved'
        : false;
      if (!approved) {
        const request = await requestApproval(
          this.runtime,
          this.ctx,
          qualifiedAction,
          params,
          `destructive action ${qualifiedAction} requires human approval`,
        );
        recordAudit(this.runtime, this.ctx, this.sourceTool, auditAction, 'pending_approval', undefined, {
          approvalRequestId: request.id,
        });
        return err('pending_approval', 'awaiting human approval', request.id, request.id);
      }
    }

    try {
      const data = await run();
      recordAudit(this.runtime, this.ctx, this.sourceTool, auditAction, 'success');
      if (policy.contribution) {
        await emitContribution(this.runtime, this.ctx, this.sourceTool, policy.contribution);
      }
      return ok(data);
    } catch (e) {
      recordAudit(this.runtime, this.ctx, this.sourceTool, auditAction, 'failure', undefined, {
        message: (e as Error).message,
      });
      return err('upstream_error', 'action failed', (e as Error).message);
    }
  }

  /**
   * Optional: when params carry an `approvalRequestId`, the guard treats the
   * call as the post-approval execution attempt. Override for custom shapes.
   */
  protected approvalIdFor(params: unknown): string | undefined {
    if (params && typeof params === 'object' && 'approvalRequestId' in params) {
      const v = (params as Record<string, unknown>).approvalRequestId;
      return typeof v === 'string' ? v : undefined;
    }
    return undefined;
  }

  // ---- author hooks ----

  protected abstract authenticateImpl(): Promise<AuthToken>;
  protected abstract listResourcesImpl(): Promise<Resource[]>;
  protected abstract readResourceImpl(id: string): Promise<Resource>;
  protected abstract writeResourceImpl(id: string, payload: unknown): Promise<void>;
  protected abstract executeActionImpl(action: string, params: unknown): Promise<Result>;
  /** Declares the policy (role/destructive/contribution) for an executeAction. */
  protected abstract policyFor(action: string): ActionPolicy;
}
