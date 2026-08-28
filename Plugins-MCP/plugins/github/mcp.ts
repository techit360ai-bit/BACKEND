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

const BLOCKED_CODE_PATH = /(^|\/)(\.env($|\.)|\.git(?:\/|$)|node_modules(?:\/|$)|\.ssh(?:\/|$)|secrets?(?:\/|$)|credentials?(?:\/|$)|[^/]*(?:credential|secret|private[-_]?key)[^/]*\.(?:json|pem|key|txt)$)/i;

function safeCodePath(value: unknown): string | null {
  const path = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').includes('..') || BLOCKED_CODE_PATH.test(path)) return null;
  return path;
}

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

    this.handle('get_repository_state', async (p) =>
      this.api.getRepositoryState(String(p.repo), String(p.branch || 'main')),
    );

    this.handle(
      'push_files',
      async (p) => {
        const files = Array.isArray(p.files) ? p.files as Record<string, unknown>[] : [];
        if (files.length === 0 || files.length > 200) throw new Error('push_files requires 1-200 file changes');
        const normalized = files.map(file => ({ path: safeCodePath(file.path), content: file.content === undefined ? undefined : String(file.content), delete: file.delete === true }));
        if (normalized.some(file => !file.path)) throw new Error('push_files contains an unsafe or sensitive path');
        const bytes = normalized.reduce((sum, file) => sum + Buffer.byteLength(file.content || '', 'utf8'), 0);
        if (bytes > 2_000_000) throw new Error('push_files payload exceeds 2 MB');
        return this.api.pushFiles({ repo: String(p.repo), branch: String(p.branch), expectedHeadSha: String(p.expectedHeadSha), message: String(p.message), files: normalized as { path: string; content?: string; delete?: boolean }[] });
      },
      'code_commit',
      (params, data) => {
        const result = data as { commitSha?: string; repo?: string; branch?: string; filesChanged?: number; message?: string };
        return { projectId: params.projectId ? String(params.projectId) : undefined, artifactId: result.commitSha ? `github:commit:${result.commitSha}` : undefined, weight: Math.max(1, Math.min(5, Number(result.filesChanged || 1))), metadata: { repo: result.repo, branch: result.branch, commitSha: result.commitSha, filesChanged: result.filesChanged, message: result.message } };
      },
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
