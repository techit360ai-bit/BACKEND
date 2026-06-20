/**
 * SDK runtime — the bundle of infra services the base classes need.
 *
 * Built once per process and handed to plugins at registration. Holds the
 * single source of truth for audit, permissions, approvals, contributions and
 * the secret vault, so every connector enforces the same plumbing.
 */

import {
  type ApprovalStore,
  type ContributionSink,
  InMemoryApprovalStore,
  InMemoryContributionSink,
} from '@techit/core';
import { type AuditLogger, InMemoryAuditLogger } from '@techit/infra-audit';
import {
  type PermissionChecker,
  DefaultPermissionChecker,
} from '@techit/infra-auth';
import { type SecretVault, InMemorySecretVault } from '@techit/infra-secrets';

export interface SdkRuntime {
  audit: AuditLogger;
  permissions: PermissionChecker;
  approvals: ApprovalStore;
  contributions: ContributionSink;
  vault: SecretVault;
}

/** Default wiring using the in-memory infra adapters (tests, local dev). */
export function createRuntime(overrides: Partial<SdkRuntime> = {}): SdkRuntime {
  return {
    audit: overrides.audit ?? new InMemoryAuditLogger(),
    permissions: overrides.permissions ?? new DefaultPermissionChecker(),
    approvals: overrides.approvals ?? new InMemoryApprovalStore(),
    contributions: overrides.contributions ?? new InMemoryContributionSink(),
    vault: overrides.vault ?? new InMemorySecretVault(),
  };
}
