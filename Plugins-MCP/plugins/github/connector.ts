/**
 * GitHubConnector — implements the Connector contract via BaseConnector hooks.
 * All audit/permission/approval/contribution plumbing is inherited; this file
 * only contains GitHub domain logic + the per-action policy.
 */

import { artifactId, createArtifact, type Artifact } from '@techit/core';
import {
  BaseConnector,
  type ActionPolicy,
  type AuthToken,
  type Resource,
  type Result,
  type SdkRuntime,
  ok,
} from '@techit/plugin-sdk';
import type { ScopedSecrets } from '@techit/infra-secrets';
import type { GitHubApi } from './github-api.js';
import { resolveToken } from './auth.js';

export class GitHubConnector extends BaseConnector {
  constructor(
    runtime: SdkRuntime,
    private readonly secrets: ScopedSecrets,
    private readonly api: GitHubApi,
    private readonly workspaceId: string,
  ) {
    super('github', runtime);
  }

  protected override authenticateImpl(): Promise<AuthToken> {
    return resolveToken(this.secrets);
  }

  protected override async listResourcesImpl(): Promise<Resource[]> {
    const repos = await this.api.listRepositories();
    return repos.map((r) => ({
      id: String(r.id),
      type: 'repository',
      title: r.fullName,
      data: { fullName: r.fullName, defaultBranch: r.defaultBranch },
    }));
  }

  protected override async readResourceImpl(id: string): Promise<Resource> {
    const repos = await this.api.listRepositories();
    const repo = repos.find((r) => String(r.id) === id);
    if (!repo) throw new Error(`repository not found: ${id}`);
    return {
      id,
      type: 'repository',
      title: repo.fullName,
      data: { fullName: repo.fullName, defaultBranch: repo.defaultBranch },
    };
  }

  protected override async writeResourceImpl(): Promise<void> {
    throw new Error('github: writeResource is not supported; use executeAction');
  }

  protected override async executeActionImpl(action: string, params: unknown): Promise<Result> {
    const p = (params ?? {}) as Record<string, unknown>;
    switch (action) {
      case 'create_pull_request': {
        const pr = await this.api.createPullRequest({
          repo: String(p.repo),
          head: String(p.head),
          base: String(p.base),
          title: String(p.title),
          body: p.body ? String(p.body) : undefined,
        });
        return ok(pr);
      }
      case 'run_workflow': {
        const run = await this.api.runWorkflow(String(p.repo), String(p.workflow), String(p.ref));
        return ok(run);
      }
      default:
        throw new Error(`github: unknown action ${action}`);
    }
  }

  protected override policyFor(action: string): ActionPolicy {
    switch (action) {
      case 'create_pull_request':
        return { requiredRole: 'editor', destructive: true, contribution: 'pull_request' };
      case 'run_workflow':
        return { requiredRole: 'admin', destructive: true, contribution: 'workflow_run' };
      default:
        return { requiredRole: 'editor', destructive: false };
    }
  }

  /** Link a repository as a TechIT artifact (type='code'). */
  linkRepositoryArtifact(repoFullName: string, repoId: number): Artifact {
    return createArtifact({
      type: 'code',
      sourceTool: 'github',
      externalId: String(repoId),
      title: repoFullName,
      workspaceId: this.workspaceId,
      metadata: { artifactId: artifactId('github', String(repoId)) },
    });
  }
}
