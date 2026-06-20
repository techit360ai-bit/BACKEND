/**
 * infra/auth — permission enforcement consulted by the SDK before any action.
 *
 * Two checks combine:
 *  1. RBAC: the acting human's role must meet the action's minimum role.
 *  2. Agent minimisation: an agent may only invoke tools in its explicit
 *     allow-list, and its workspace must match the resource's workspace.
 *
 * `check()` returns a structured decision; it never throws. The SDK turns a
 * denial into a structured error and an audit entry.
 */

import type { Actor, AgentDefinition, Role } from '@techit/core';
import { roleSatisfies } from './rbac.js';

export * from './rbac.js';

export interface PermissionRequest {
  actor: Actor;
  /** Fully-qualified action/tool id, e.g. 'github.create_pull_request'. */
  action: string;
  /** Minimum human role this action requires. */
  requiredRole: Role;
  /** Workspace the target resource belongs to. */
  resourceWorkspaceId: string;
  /** Present when the actor is an agent. */
  agent?: AgentDefinition;
}

export type DenyReason =
  | 'insufficient_role'
  | 'workspace_isolation'
  | 'tool_not_allowed'
  | 'agent_definition_invalid';

export interface PermissionDecision {
  allowed: boolean;
  reason?: DenyReason;
  detail?: string;
}

const ALLOW: PermissionDecision = { allowed: true };

export interface PermissionChecker {
  check(req: PermissionRequest): PermissionDecision;
}

export class DefaultPermissionChecker implements PermissionChecker {
  check(req: PermissionRequest): PermissionDecision {
    // Workspace-level data isolation applies to every actor.
    if (req.actor.workspaceId !== req.resourceWorkspaceId) {
      return {
        allowed: false,
        reason: 'workspace_isolation',
        detail: `actor workspace ${req.actor.workspaceId} != resource workspace ${req.resourceWorkspaceId}`,
      };
    }

    // RBAC on the human role (agents carry their delegating principal's role).
    if (!roleSatisfies(req.actor.role, req.requiredRole)) {
      return {
        allowed: false,
        reason: 'insufficient_role',
        detail: `role ${req.actor.role} < required ${req.requiredRole}`,
      };
    }

    if (req.actor.kind === 'agent') {
      const agent = req.agent;
      if (!agent || agent.toolsAllowed.some((t) => t.includes('*'))) {
        return {
          allowed: false,
          reason: 'agent_definition_invalid',
          detail: 'agent definition missing or contains wildcard tools',
        };
      }
      if (!agent.toolsAllowed.includes(req.action)) {
        return {
          allowed: false,
          reason: 'tool_not_allowed',
          detail: `tool ${req.action} not in agent allow-list`,
        };
      }
    }

    return ALLOW;
  }
}
