/**
 * Approval gate. A destructive action does not execute: instead it creates an
 * ApprovalRequest (status `pending`) and the caller returns `pending_approval`.
 * Execution only proceeds once a recorded ApprovalDecision is `approved`.
 */

import { makeApprovalRequest, type ApprovalRequest } from '@techit/core';
import type { CallContext } from '../contract/types.js';
import type { SdkRuntime } from '../runtime.js';

export async function requestApproval(
  runtime: SdkRuntime,
  ctx: CallContext,
  action: string,
  params: unknown,
  reason: string,
): Promise<ApprovalRequest> {
  const request = makeApprovalRequest({
    workspaceId: ctx.actor.workspaceId,
    requestedBy: ctx.actor.id,
    action,
    params,
    reason,
  });
  await runtime.approvals.create(request);
  return request;
}

/** True once the named approval request has been approved by a human. */
export async function isApproved(runtime: SdkRuntime, requestId: string): Promise<boolean> {
  const req = await runtime.approvals.get(requestId);
  return req?.status === 'approved';
}
