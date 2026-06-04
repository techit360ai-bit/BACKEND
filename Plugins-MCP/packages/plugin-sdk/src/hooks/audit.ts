/** Thin call into infra/audit. */

import type { AuditInput, AuditResult } from '@techit/infra-audit';
import type { CallContext } from '../contract/types.js';
import type { SdkRuntime } from '../runtime.js';

export function recordAudit(
  runtime: SdkRuntime,
  ctx: CallContext,
  sourceTool: string,
  action: string,
  result: AuditResult,
  resource?: string,
  detail?: Record<string, unknown>,
): void {
  const input: AuditInput = {
    actor: ctx.actor.id,
    actorKind: ctx.actor.kind,
    action,
    sourceTool,
    resource,
    result,
    workspaceId: ctx.actor.workspaceId,
    detail,
  };
  runtime.audit.write(input);
}
