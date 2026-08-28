import { fileURLToPath } from 'node:url'
import type { MCPRegistry } from '@techit/mcp-client'
import { BasePlugin, loadManifest, type AuthToken, type PluginManifest, type SdkRuntime } from '@techit/plugin-sdk'
import type { ScopedSecrets } from '@techit/infra-secrets'
import { FakeGitHostApi, RealBitbucketApi, RealGitLabApi, type GitHostApi } from './git-host-api.js'
import { GitHostMCPServer } from './mcp.js'

class GitHostPlugin extends BasePlugin {
  mcp!: GitHostMCPServer
  constructor(manifest: PluginManifest, private readonly api: GitHostApi, private readonly envToken: string) { super(manifest) }
  protected async authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken> { let lease = await secrets.get('access_token'); if (!lease && this.envToken) { await secrets.set('access_token', this.envToken, 24 * 3600); lease = await secrets.get('access_token') } if (!lease && ['production', 'staging'].includes((process.env.NODE_ENV || '').toLowerCase())) throw new Error(`${this.name} token is required`); return { accessToken: lease?.value || 'dev-token', tokenType: 'Bearer', scopes: this.manifest.auth.scopes } }
  async install(runtime: SdkRuntime, registry: MCPRegistry) { await this.register(runtime); this.mcp = new GitHostMCPServer(this.name, runtime, this.manifest.mcp.tools, this.api); registry.register(this.name, this.mcp); return this }
}

async function register(provider: 'gitlab' | 'bitbucket', runtime: SdkRuntime, registry: MCPRegistry, api?: GitHostApi) {
  const manifest = loadManifest(fileURLToPath(new URL(`./${provider}.plugin.yaml`, import.meta.url)))
  const tokenName = provider === 'gitlab' ? 'MCP_GITLAB_TOKEN' : 'MCP_BITBUCKET_TOKEN'
  const modeName = provider === 'gitlab' ? 'GITLAB_CONNECTOR_MODE' : 'BITBUCKET_CONNECTOR_MODE'
  const token = process.env[tokenName] || ''
  const real = provider === 'gitlab' ? new RealGitLabApi(async () => token) : new RealBitbucketApi(async () => token)
  return new GitHostPlugin(manifest, api || (process.env[modeName] === 'real' ? real : new FakeGitHostApi(provider)), token).install(runtime, registry)
}

export const registerGitLabPlugin = (opts: { runtime: SdkRuntime; registry: MCPRegistry; api?: GitHostApi }) => register('gitlab', opts.runtime, opts.registry, opts.api)
export const registerBitbucketPlugin = (opts: { runtime: SdkRuntime; registry: MCPRegistry; api?: GitHostApi }) => register('bitbucket', opts.runtime, opts.registry, opts.api)
export { FakeGitHostApi, RealGitLabApi, RealBitbucketApi, type GitHostApi } from './git-host-api.js'
