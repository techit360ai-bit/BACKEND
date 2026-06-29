/**
 * Approval gate. A destructive action does not execute: instead it creates an
 * ApprovalRequest (status `pending`) and the caller returns `pending_approval`.
 * Execution only proceeds once a recorded ApprovalDecision is `approved`.
 */

import { makeApprovalRequest, type ApprovalRequest } from '@techit/core';
import type { CallContext } from '../contract/types.js';
import type { SdkRuntime } from '../runtime.js';

export const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000;

export type ApprovalValidation =
  | { ok: true; request: ApprovalRequest }
  | { ok: false; reason: 'not_found' | 'not_approved' | 'expired' | 'workspace_mismatch' | 'action_mismatch' | 'used' };

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

export async function validateApproval(
  runtime: SdkRuntime,
  ctx: CallContext,
  requestId: string,
  action: string,
  ttlMs = Number(process.env.MCP_APPROVAL_TTL_MS || DEFAULT_APPROVAL_TTL_MS),
): Promise<ApprovalValidation> {
  const req = await runtime.approvals.get(requestId);
  if (!req) return { ok: false, reason: 'not_found' };
  if (req.status === 'used') return { ok: false, reason: 'used' };
  if (req.status !== 'approved') return { ok: false, reason: 'not_approved' };
  if (req.workspaceId !== ctx.actor.workspaceId || req.workspaceId !== ctx.resourceWorkspaceId) {
    return { ok: false, reason: 'workspace_mismatch' };
  }
  if (req.action !== action) return { ok: false, reason: 'action_mismatch' };

  const createdAt = Date.parse(req.createdAt);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > ttlMs) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, request: req };
}

export async function consumeApproval(
  runtime: SdkRuntime,
  request: ApprovalRequest,
  actorId: string,
): Promise<void> {
  await runtime.approvals.decide({
    requestId: request.id,
    decidedBy: actorId,
    status: 'used',
    decidedAt: new Date().toISOString(),
    comment: 'consumed by MCP execution',
  });
}
