/**
 * BasePlugin — lifecycle host.
 *
 *   register(runtime) → resolves a SCOPED secrets handle → authenticate() → ready
 *
 * The plugin only ever receives `secrets://<this.name>/*`; it cannot reach
 * another plugin's namespace. Subclasses implement `authenticateImpl()`.
 */

import type { ScopedSecrets } from '@techit/infra-secrets';
import type { PluginManifest } from '../manifest/schema.js';
import type { AuthToken } from '../contract/types.js';
import type { SdkRuntime } from '../runtime.js';

export type PluginPhase = 'created' | 'registered' | 'authenticated' | 'ready';

export abstract class BasePlugin {
  readonly manifest: PluginManifest;
  protected runtime!: SdkRuntime;
  protected secrets!: ScopedSecrets;
  private phase: PluginPhase = 'created';

  constructor(manifest: PluginManifest) {
    this.manifest = manifest;
  }

  get name(): string {
    return this.manifest.name;
  }

  get phase_(): PluginPhase {
    return this.phase;
  }

  /** Called by the registry. Binds runtime + scoped secrets, then authenticates. */
  async register(runtime: SdkRuntime): Promise<void> {
    this.runtime = runtime;
    this.secrets = runtime.vault.scopeTo(this.manifest.name);
    this.phase = 'registered';
    await this.authenticate();
    this.phase = 'ready';
  }

  async authenticate(): Promise<AuthToken> {
    const token = await this.authenticateImpl(this.secrets);
    this.phase = 'authenticated';
    return token;
  }

  /** Subclasses perform OAuth/api-key exchange using only the scoped handle. */
  protected abstract authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken>;
}
