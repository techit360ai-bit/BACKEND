import { fileURLToPath } from 'node:url'
import type { MCPRegistry } from '@techit/mcp-client'
import { BasePlugin, loadManifest, type AuthToken, type PluginManifest, type SdkRuntime, WorkspaceCredentialHandle } from '@techit/plugin-sdk'
import type { ScopedSecrets } from '@techit/infra-secrets'
import { FakeGitHostApi, RealBitbucketApi, RealGitLabApi, type GitHostApi } from './git-host-api.js'
import { GitHostMCPServer } from './mcp.js'

class GitHostPlugin extends BasePlugin {
  mcp!: GitHostMCPServer
  constructor(manifest: PluginManifest, private readonly api: GitHostApi, private readonly creds: WorkspaceCredentialHandle) { super(manifest) }
  // Boot MUST NOT require a credential (ADR-1/ADR-3): workspace credentials are
  // resolved lazily at invoke time from the canonical lane. Never seed the lane
  // from an env token here — that would be a dynamic MCP_*_TOKEN fallback.
  protected async authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken> {
    const lease = await secrets.get('access_token')
    return { accessToken: lease?.value || '', tokenType: 'Bearer', scopes: this.manifest.auth.scopes }
  }
  async install(runtime: SdkRuntime, registry: MCPRegistry) { await this.register(runtime); this.mcp = new GitHostMCPServer(this.name, runtime, this.manifest.mcp.tools, this.api, this.creds); registry.register(this.name, this.mcp); return this }
}

async function register(provider: 'gitlab' | 'bitbucket', runtime: SdkRuntime, registry: MCPRegistry, api?: GitHostApi) {
  const manifest = loadManifest(fileURLToPath(new URL(`./${provider}.plugin.yaml`, import.meta.url)))
  const modeName = provider === 'gitlab' ? 'GITLAB_CONNECTOR_MODE' : 'BITBUCKET_CONNECTOR_MODE'
  const creds = new WorkspaceCredentialHandle(runtime.vault, provider, manifest.auth.scopes)
  // token() enforces provider + scope at resolve time (ADR-1 step 3): a missing
  // credential throws CredentialMissingError; a recorded-but-insufficient scope
  // set throws ScopeInsufficientError. Never a fallback.
  const resolveToken = async () => creds.token('access_token')
  const real = provider === 'gitlab' ? new RealGitLabApi(resolveToken) : new RealBitbucketApi(resolveToken)
  return new GitHostPlugin(manifest, api || (process.env[modeName] === 'real' ? real : new FakeGitHostApi(provider)), creds).install(runtime, registry)
}

export const registerGitLabPlugin = (opts: { runtime: SdkRuntime; registry: MCPRegistry; api?: GitHostApi }) => register('gitlab', opts.runtime, opts.registry, opts.api)
export const registerBitbucketPlugin = (opts: { runtime: SdkRuntime; registry: MCPRegistry; api?: GitHostApi }) => register('bitbucket', opts.runtime, opts.registry, opts.api)
export { FakeGitHostApi, RealGitLabApi, RealBitbucketApi, type GitHostApi } from './git-host-api.js'
