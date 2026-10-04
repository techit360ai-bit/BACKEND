/**
 * WorkspaceCredentialHandle — per-invoke, workspace-scoped credential access.
 *
 * A connector is registered once per process, so it cannot capture "the"
 * workspace at construction time. The acting workspace is known only when a
 * call is bound (`BaseMCPServer.bind(ctx)` / `BaseConnector.bind(ctx)`), so the
 * handle is a small mutable pointer the bound server updates before invoking.
 *
 * Reads resolve against the CANONICAL workspace lane (`secrets://ws/<ws>/<p>/`).
 * When no workspace is bound the handle falls back to the legacy lane
 * (`secrets://<plugin>/`) — this is the bootstrap path only (ADR-3); a
 * user-facing request always has a workspace, so it never silently uses it.
 */

import type { ScopedSecrets, SecretVault } from '@techit/infra-secrets';

/**
 * Thrown by a real-API credential resolver when the acting workspace has no
 * credential. `BaseMCPServer` maps it to a `credential_missing` DENY — never a
 * fallback, never a generic upstream error.
 */
export class CredentialMissingError extends Error {
  constructor(
    public readonly plugin: string,
    detail?: string,
  ) {
    super(`connect_required: ${plugin} has no credential for this workspace${detail ? ` (${detail})` : ''}`);
    this.name = 'CredentialMissingError';
  }
}

export class WorkspaceCredentialHandle {
  private workspaceId: string | undefined;

  constructor(
    private readonly vault: SecretVault,
    private readonly plugin: string,
  ) {}

  /** Point the handle at the acting workspace for subsequent reads. */
  use(workspaceId: string | undefined): this {
    this.workspaceId = workspaceId;
    return this;
  }

  /** The workspace this handle currently reads for (undefined = bootstrap lane). */
  get owner(): string | undefined {
    return this.workspaceId;
  }

  /** Scoped secrets for the current workspace. */
  secrets(): ScopedSecrets {
    return this.vault.scopeTo(this.plugin, this.workspaceId);
  }

  /** Current secret value for `key`, or undefined when absent. */
  async value(key: string): Promise<string | undefined> {
    return (await this.secrets().get(key))?.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.secrets().set(key, value, ttlSeconds);
  }

  async delete(key: string): Promise<boolean> {
    return this.secrets().delete(key);
  }
}
