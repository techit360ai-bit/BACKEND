/**
 * infra/secrets — token vault with per-plugin isolated namespaces.
 *
 * Zero-trust: a plugin never receives the raw vault. `BasePlugin` resolves a
 * *scoped handle* bound to `secrets://<plugin>/*`. A scoped handle physically
 * cannot read or write another plugin's namespace — keys are prefixed and the
 * prefix is stripped/enforced inside the handle, so cross-namespace access is
 * impossible by construction rather than by policy.
 */

export interface SecretLease {
  readonly value: string;
  /** ISO timestamp when the lease expires and must be refreshed. */
  readonly expiresAt: string;
}

/** What a plugin sees: operations confined to its own namespace. */
export interface ScopedSecrets {
  readonly namespace: string;
  get(key: string): Promise<SecretLease | undefined>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Rotate (replace) a secret, returning the fresh lease. */
  rotate(key: string, value: string, ttlSeconds?: number): Promise<SecretLease>;
  /**
   * Remove a secret. Returns true when one was present. Used by the disconnect
   * flow — an operator who revokes a connector credential must be able to take
   * it out of the vault, not merely overwrite it.
   */
  delete(key: string): Promise<boolean>;
}

/** Full vault interface — only infra/SDK hold this, never plugins. */
export interface SecretVault {
  /**
   * Returns a handle confined to a single namespace.
   *
   *  - `scopeTo(plugin)`            → legacy/bootstrap lane `secrets://<plugin>/`
   *  - `scopeTo(plugin, workspaceId)` → workspace lane `secrets://ws/<workspaceId>/<plugin>/`
   *
   * The workspace lane is the canonical store (ADR-1/ADR-2). The legacy lane
   * exists only so a one-time bootstrap import can read what used to live in
   * env vars; it MUST NOT be the long-term read path.
   */
  scopeTo(plugin: string, owner?: string): ScopedSecrets;
}

/** Characters allowed in a workspace/owner segment of a namespace. */
const OWNER_RE = /^[A-Za-z0-9._-]+$/;
/** Characters allowed in a plugin segment (matches the Postgres store). */
const PLUGIN_RE = /^[a-z0-9_-]+$/i;

/**
 * Build the vault namespace for a plugin within an optional workspace owner.
 * Centralised so the in-memory and Postgres vaults cannot drift.
 */
export function vaultNamespace(plugin: string, owner?: string): string {
  if (!plugin || !PLUGIN_RE.test(plugin)) throw new Error(`invalid plugin namespace: ${plugin}`);
  if (owner === undefined) return `secrets://${plugin}/`;
  if (!owner || !OWNER_RE.test(owner)) throw new Error(`invalid workspace namespace: ${owner}`);
  return `secrets://ws/${owner}/${plugin}/`;
}

/** True when a namespace is the canonical workspace lane (not legacy/bootstrap). */
export function isWorkspaceNamespace(namespace: string): boolean {
  return namespace.startsWith('secrets://ws/');
}

/**
 * TTL applied when a caller passes none: **0 = never expires**.
 *
 * This is deliberately the same default `EncryptedPgSecretVault` uses, and it
 * was NOT always so. The in-memory vault used to default to 3600s while the
 * Postgres vault defaulted to never — the same `secrets.set(key, value)` call
 * therefore meant "durable credential" in production and "gone in an hour" in
 * dev. A connector token stored that way made `resolveToken` start throwing
 * `no stored OAuth token` an hour after a successful connect, with nothing in
 * between to explain it. Pass an explicit ttlSeconds for anything genuinely
 * short-lived.
 */
const DEFAULT_TTL_SECONDS = 0;

/**
 * Sentinel `expiresAt` for a secret with no expiry. Shared with the Postgres
 * vault so a caller cannot tell which store it is talking to — the API surfaces
 * this value verbatim, and the dashboard reads it to mean "does not expire".
 */
export const NEVER_EXPIRES = '9999-12-31T23:59:59.999Z';

function leaseExpiry(ttlSeconds: number): string {
  return ttlSeconds > 0
    ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
    : NEVER_EXPIRES;
}

/**
 * In-memory vault. Production replaces this with a Vault/AWS Secrets Manager
 * adapter behind the same interface. The namespace prefixing logic is identical.
 */
export class InMemorySecretVault implements SecretVault {
  private readonly store = new Map<string, SecretLease>();

  scopeTo(plugin: string, owner?: string): ScopedSecrets {
    const prefix = vaultNamespace(plugin, owner);
    const store = this.store;

    return {
      namespace: prefix,
      async get(key: string): Promise<SecretLease | undefined> {
        const lease = store.get(prefix + key);
        if (!lease) return undefined;
        if (Date.parse(lease.expiresAt) <= Date.now()) {
          store.delete(prefix + key);
          return undefined;
        }
        return lease;
      },
      async set(key: string, value: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
        store.set(prefix + key, { value, expiresAt: leaseExpiry(ttlSeconds) });
      },
      async rotate(
        key: string,
        value: string,
        ttlSeconds = DEFAULT_TTL_SECONDS,
      ): Promise<SecretLease> {
        const lease: SecretLease = { value, expiresAt: leaseExpiry(ttlSeconds) };
        store.set(prefix + key, lease);
        return lease;
      },
      async delete(key: string): Promise<boolean> {
        return store.delete(prefix + key);
      },
    };
  }
}
