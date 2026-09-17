import { describe, expect, it } from 'vitest'
import { createRuntime } from '@techit/plugin-sdk'
import { MCPClient, MCPRegistry } from '@techit/mcp-client'
import { FakeGitHostApi, registerBitbucketPlugin, registerGitLabPlugin } from '@techit/plugin-git-host'
import { ownerActor } from './helpers.js'

describe('multi-destination git host adapters', () => {
  it('registers provider-neutral GitLab and Bitbucket sync and check tools', async () => {
    const runtime = createRuntime(); const registry = new MCPRegistry()
    await registerGitLabPlugin({ runtime, registry, api: new FakeGitHostApi('gitlab') })
    await registerBitbucketPlugin({ runtime, registry, api: new FakeGitHostApi('bitbucket') })
    const client = new MCPClient(registry); const context = { actor: ownerActor(), resourceWorkspaceId: 'ws-1' }
    for (const provider of ['gitlab', 'bitbucket']) {
      const state = await client.invoke(provider, 'get_repository_state', { projectId: 'p1', repo: 'team/app', branch: 'main' }, context)
      expect(state.ok).toBe(true)
      const checks = await client.invoke(provider, 'get_commit_checks', { projectId: 'p1', repo: 'team/app', commitSha: `${provider}-head-1` }, context)
      expect(checks).toMatchObject({ ok: true, data: { providerStatus: 'success' } })
    }
  })
})
