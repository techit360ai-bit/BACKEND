/**
 * GitHubMCPServer — exposes GitHub capabilities as MCP tools.
 * Destructive tools (create_pull_request, run_workflow) are declared destructive
 * in the manifest, so BaseMCPServer routes them through the approval gate
 * automatically — no per-tool approval code here.
 */

import {
  BaseMCPServer,
  type ManifestMCPTool,
  type SdkRuntime,
} from '@techit/plugin-sdk';
import type { GitHubApi } from './github-api.js';

export class GitHubMCPServer extends BaseMCPServer {
  constructor(runtime: SdkRuntime, toolSpecs: ManifestMCPTool[], private readonly api: GitHubApi) {
    super('github', runtime, toolSpecs);

    this.handle('list_repositories', async (p) =>
      this.api.listRepositories(p.org ? String(p.org) : undefined),
    );

    this.handle('read_file', async (p) =>
      this.api.readFile(String(p.repo), String(p.path), p.ref ? String(p.ref) : undefined),
    );

    this.handle('list_issues', async (p) =>
      this.api.listIssues(String(p.repo), p.state ? String(p.state) : undefined),
    );

    this.handle('get_pr_status', async (p) =>
      this.api.getPrStatus(String(p.repo), Number(p.number)),
    );

    this.handle(
      'create_pull_request',
      async (p) =>
        this.api.createPullRequest({
          repo: String(p.repo),
          head: String(p.head),
          base: String(p.base),
          title: String(p.title),
          body: p.body ? String(p.body) : undefined,
        }),
      'pull_request',
    );

    this.handle(
      'run_workflow',
      async (p) => this.api.runWorkflow(String(p.repo), String(p.workflow), String(p.ref)),
      'workflow_run',
    );
  }
}
