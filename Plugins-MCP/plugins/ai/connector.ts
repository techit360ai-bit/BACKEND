/**
 * AiHarnessConnector — wraps the TechIT ai-router via BaseConnector hooks.
 * All audit/permission/approval/contribution plumbing is inherited; this file
 * only holds AI-harness domain logic + the per-action policy.
 *
 * The only destructive action is `run_sandbox` (admin, approval-gated) — and
 * even then execution is simulated, never real.
 */

import {
  BaseConnector,
  type ActionPolicy,
  type AuthToken,
  type Resource,
  type Result,
  type SdkRuntime,
  ok,
} from '@techit/plugin-sdk';
import type { ScopedSecrets } from '@techit/infra-secrets';
import type { AiHarnessApi } from './ai-api.js';
import { resolveToken } from './auth.js';

export class AiHarnessConnector extends BaseConnector {
  constructor(
    runtime: SdkRuntime,
    private readonly secrets: ScopedSecrets,
    private readonly api: AiHarnessApi,
    private readonly workspaceId: string,
  ) {
    super('ai', runtime);
  }

  protected override authenticateImpl(): Promise<AuthToken> {
    return resolveToken(this.secrets);
  }

  protected override async listResourcesImpl(): Promise<Resource[]> {
    return [];
  }

  protected override async readResourceImpl(id: string): Promise<Resource> {
    throw new Error(`ai: readResource is not supported (id=${id})`);
  }

  protected override async writeResourceImpl(): Promise<void> {
    throw new Error('ai: writeResource is not supported; use executeAction');
  }

  protected override async executeActionImpl(action: string, params: unknown): Promise<Result> {
    const p = (params ?? {}) as Record<string, unknown>;
    switch (action) {
      case 'generate_code':
        return ok(await this.api.generateCode(String(p.prompt), p.language ? String(p.language) : undefined));
      case 'review_code':
        return ok(
          await this.api.reviewCode(
            String(p.code),
            p.language ? String(p.language) : undefined,
            p.context ? String(p.context) : undefined,
          ),
        );
      case 'deep_research':
        return ok(await this.api.deepResearch(String(p.query), p.depth ? String(p.depth) : undefined));
      case 'run_sandbox':
        return ok(await this.api.runSandbox(String(p.language), String(p.code)));
      default:
        throw new Error(`ai: unknown action ${action}`);
    }
  }

  protected override policyFor(action: string): ActionPolicy {
    switch (action) {
      case 'run_sandbox':
        return { requiredRole: 'admin', destructive: true, contribution: 'ai_action' };
      default:
        return { requiredRole: 'editor', destructive: false, contribution: 'ai_action' };
    }
  }

  workspaceScope(): string {
    return this.workspaceId;
  }
}
