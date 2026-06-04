/**
 * GitHub plugin entry point.
 *
 *   const plugin = await registerGithubPlugin({ runtime, registry, workspaceId });
 *
 * Builds the connector + MCP server bound to the plugin's scoped secrets, runs
 * the lifecycle (register → authenticate → ready) and registers the MCP server
 * with the client registry. Adding GitHub to the agent runtime = this one call.
 */

import { fileURLToPath } from 'node:url';
import type { MCPRegistry } from '@techit/mcp-client';
import {
  BasePlugin,
  loadManifest,
  type AuthToken,
  type PluginManifest,
  type SdkRuntime,
} from '@techit/plugin-sdk';
import type { ScopedSecrets } from '@techit/infra-secrets';
import { GitHubConnector } from './connector.js';
import { GitHubMCPServer } from './mcp.js';
import { FakeGitHubApi, type GitHubApi } from './github-api.js';
import { StubOAuthExchange, resolveToken, storeToken, type OAuthExchange } from './auth.js';

const MANIFEST_PATH = fileURLToPath(new URL('./techit.plugin.yaml', import.meta.url));

export interface GithubPluginOptions {
  runtime: SdkRuntime;
  registry: MCPRegistry;
  workspaceId: string;
  /** Override for real GitHub API (defaults to in-memory fake). */
  api?: GitHubApi;
  /** Override for the real OAuth token exchange (defaults to a stub). */
  oauth?: OAuthExchange;
  manifestPath?: string;
}

export class GitHubPlugin extends BasePlugin {
  connector!: GitHubConnector;
  mcp!: GitHubMCPServer;

  constructor(
    manifest: PluginManifest,
    private readonly api: GitHubApi,
    private readonly oauth: OAuthExchange,
    private readonly workspaceId: string,
  ) {
    super(manifest);
  }

  protected override async authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken> {
    // Dev/reference convenience: if no token is stored yet, run the (stub) OAuth
    // exchange once so the lifecycle reaches `ready`. Production supplies a real
    // exchange and an explicit connect step.
    const existing = await secrets.get('oauth_access_token');
    if (!existing) {
      await storeToken(secrets, this.oauth, 'devcode');
    }
    return resolveToken(secrets);
  }

  /** Build connector + MCP server once secrets are bound. */
  private buildComponents(): void {
    this.connector = new GitHubConnector(this.runtime, this.secrets, this.api, this.workspaceId);
    this.mcp = new GitHubMCPServer(this.runtime, this.manifest.mcp.tools, this.api);
  }

  static async install(opts: GithubPluginOptions): Promise<GitHubPlugin> {
    const manifest = loadManifest(opts.manifestPath ?? MANIFEST_PATH);
    const plugin = new GitHubPlugin(
      manifest,
      opts.api ?? new FakeGitHubApi(),
      opts.oauth ?? new StubOAuthExchange(),
      opts.workspaceId,
    );
    await plugin.register(opts.runtime);
    plugin.buildComponents();
    opts.registry.register(manifest.name, plugin.mcp);
    return plugin;
  }
}

export async function registerGithubPlugin(opts: GithubPluginOptions): Promise<GitHubPlugin> {
  return GitHubPlugin.install(opts);
}

export { GitHubConnector } from './connector.js';
export { GitHubMCPServer } from './mcp.js';
export { parseWebhook, type TechitEvent } from './webhook.js';
export { FakeGitHubApi, type GitHubApi } from './github-api.js';
