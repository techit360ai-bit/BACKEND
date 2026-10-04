/**
 * Frozen contract types shared by every connector.
 */

import type { Actor, AgentDefinition } from '@techit/core';

export interface AuthToken {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly scopes: readonly string[];
  readonly expiresAt?: string;
}

export interface Resource {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly data: Record<string, unknown>;
}

/** Structured error model — `invoke()` and friends surface this, never a throw. */
export interface PluginError {
  readonly error: string;
  readonly code: PluginErrorCode;
  readonly detail?: string;
}

export type PluginErrorCode =
  | 'permission_denied'
  | 'pending_approval'
  | 'not_found'
  | 'invalid_input'
  | 'auth_failed'
  // Clean DENY when the acting workspace has no credential for a connector:
  // the caller must connect the provider for that workspace (ADR-1/ADR-3). It is
  // deliberately distinct from auth_failed so a missing credential never looks
  // like a bad token, and never triggers any fallback.
  | 'credential_missing'
  // Clean DENY when a stored credential's scopes do not cover what the connector
  // requires (verified at resolve time; ADR-1 step "verify provider + scope").
  | 'scope_insufficient'
  | 'upstream_error'
  | 'internal_error';

/** Discriminated result returned by connector/adapter operations. */
export type Result<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: PluginError; approvalRequestId?: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(
  code: PluginErrorCode,
  message: string,
  detail?: string,
  approvalRequestId?: string,
): Result<never> {
  const out: Result<never> = { ok: false, error: { error: message, code, detail } };
  if (approvalRequestId) (out as { approvalRequestId?: string }).approvalRequestId = approvalRequestId;
  return out;
}

/** MCP tool descriptor, mirroring the open MCP spec. */
export interface MCPTool {
  readonly name: string;
  readonly description: string;
  /** JSON Schema for the tool's params. */
  readonly input_schema: Record<string, unknown>;
  /** Marks tools that mutate external state → routed through the approval gate. */
  readonly destructive?: boolean;
}

/**
 * Workspace execution coordinates for a call (WS-H).
 *
 * A workspace is where execution happens; the incubation hub owns the project it
 * belongs to. Threading these onto `CallContext` lets every audit + contribution
 * event be attributed to the right project/stage/goal so ANY consumer surface
 * (workspace dashboard, incubation hub, investor, organization, hackathon)
 * reads one canonical execution stream instead of building its own.
 */
export interface IncubationContext {
  readonly projectId?: string;
  /** Incubation stage, e.g. idea | validating | building_mvp | beta_testing | launched | scaling. */
  readonly stage?: string;
  /** Composite startup-intelligence score for the project at call time. */
  readonly gsis?: number;
  /** Active goal for the project. */
  readonly goal?: string;
  readonly organizationId?: string;
  readonly programId?: string;
  readonly cohortId?: string;
  readonly hackathonId?: string;
}

/**
 * Execution context threaded through every call: who is acting, in which
 * workspace, and (for agents) their definition for permission minimisation.
 */
export interface CallContext {
  readonly actor: Actor;
  readonly agent?: AgentDefinition;
  /** Workspace of the resource being touched (isolation check). */
  readonly resourceWorkspaceId: string;
  /** Incubation/campaign coordinates for this call, resolved server-side (WS-H). */
  readonly incubation?: IncubationContext;
}
