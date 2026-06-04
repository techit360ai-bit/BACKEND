/** Permission pre-check. Returns the infra decision; caller logs + converts on deny. */

import type { Role } from '@techit/core';
import type { PermissionDecision } from '@techit/infra-auth';
import type { CallContext } from '../contract/types.js';
import type { SdkRuntime } from '../runtime.js';

export function checkPermission(
  runtime: SdkRuntime,
  ctx: CallContext,
  action: string,
  requiredRole: Role,
): PermissionDecision {
  return runtime.permissions.check({
    actor: ctx.actor,
    action,
    requiredRole,
    resourceWorkspaceId: ctx.resourceWorkspaceId,
    agent: ctx.agent,
  });
}
