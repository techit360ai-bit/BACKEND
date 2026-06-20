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
}

/** Full vault interface — only infra/SDK hold this, never plugins. */
export interface SecretVault {
  /** Returns a handle confined to `secrets://<plugin>/*`. */
  scopeTo(plugin: string): ScopedSecrets;
}

const DEFAULT_TTL_SECONDS = 3600;

function leaseExpiry(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

/**
 * In-memory vault. Production replaces this with a Vault/AWS Secrets Manager
 * adapter behind the same interface. The namespace prefixing logic is identical.
 */
export class InMemorySecretVault implements SecretVault {
  private readonly store = new Map<string, SecretLease>();

  scopeTo(plugin: string): ScopedSecrets {
    if (!plugin || plugin.includes('/')) {
      throw new Error(`invalid plugin namespace: ${plugin}`);
    }
    const prefix = `secrets://${plugin}/`;
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
    };
  }
}
