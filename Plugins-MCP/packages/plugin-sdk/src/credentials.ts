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

/** Companion key holding the granted scope set for a stored credential (metadata, not a secret). */
export const CREDENTIAL_SCOPES_KEY = '__scopes';

/**
 * Thrown when a stored credential's recorded scopes do not cover what the
 * connector requires. `BaseMCPServer` maps it to `scope_insufficient`.
 */
export class ScopeInsufficientError extends Error {
  constructor(
    public readonly plugin: string,
    public readonly missing: string[],
  ) {
    super(`scope_insufficient: ${plugin} credential is missing scope(s): ${missing.join(', ')}`);
    this.name = 'ScopeInsufficientError';
  }
}

export class WorkspaceCredentialHandle {
  private workspaceId: string | undefined;

  constructor(
    private readonly vault: SecretVault,
    private readonly plugin: string,
    /** Scopes this connector requires (from the manifest); enforced at resolve. */
    private readonly requiredScopes: readonly string[] = [],
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

  /**
   * Resolve a credential with provider + SCOPE verification at call time.
   *
   *  - missing credential → CredentialMissingError (clean DENY)
   *  - recorded scopes known and not a superset of requiredScopes →
   *    ScopeInsufficientError (clean DENY)
   *  - scopes unknown (pasted opaque token) → allowed, provider is the backstop;
   *    the connection status reports `scopesVerified: false` so it is visible.
   */
  async token(key: string): Promise<string> {
    const secrets = this.secrets();
    const lease = await secrets.get(key);
    if (!lease) throw new CredentialMissingError(this.plugin);
    await this.assertScopes(secrets);
    return lease.value;
  }

  /** Recorded granted scopes for this credential (empty when unknown). */
  async grantedScopes(): Promise<string[]> {
    const raw = await this.secrets().get(CREDENTIAL_SCOPES_KEY);
    if (!raw?.value) return [];
    try {
      const parsed = JSON.parse(raw.value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private async assertScopes(secrets: ReturnType<WorkspaceCredentialHandle['secrets']>): Promise<void> {
    if (this.requiredScopes.length === 0) return;
    const raw = await secrets.get(CREDENTIAL_SCOPES_KEY);
    // No scope record → unknown scopes (e.g. an opaque pasted token). We cannot
    // verify, so we do not block; the provider enforces its own scope at call.
    if (!raw?.value) return;
    let granted: string[] = [];
    try {
      const parsed = JSON.parse(raw.value);
      granted = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return;
    }
    if (granted.length === 0) return;
    const missing = this.requiredScopes.filter((scope) => !granted.includes(scope));
    if (missing.length > 0) throw new ScopeInsufficientError(this.plugin, missing);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.secrets().set(key, value, ttlSeconds);
  }

  async delete(key: string): Promise<boolean> {
    return this.secrets().delete(key);
  }
}
