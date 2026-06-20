/**
 * Minimal GitHub API surface used by the connector + MCP server.
 *
 * The interface is what production wires to `https://api.github.com` (via fetch
 * + the OAuth token). `FakeGitHubApi` is an in-memory implementation so the
 * reference connector and its tests run without network access.
 */

export interface GhRepo {
  id: number;
  fullName: string;
  defaultBranch: string;
}

export interface GhPullRequest {
  number: number;
  repo: string;
  title: string;
  head: string;
  base: string;
  state: 'open' | 'closed' | 'merged';
}

export interface GhPrStatus {
  number: number;
  mergeable: boolean;
  checks: { name: string; conclusion: 'success' | 'failure' | 'pending' }[];
}

export interface GhIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
}

export interface GitHubApi {
  listRepositories(org?: string): Promise<GhRepo[]>;
  readFile(repo: string, path: string, ref?: string): Promise<string>;
  listIssues(repo: string, state?: string): Promise<GhIssue[]>;
  getPrStatus(repo: string, num: number): Promise<GhPrStatus>;
  createPullRequest(input: {
    repo: string;
    head: string;
    base: string;
    title: string;
    body?: string;
  }): Promise<GhPullRequest>;
  runWorkflow(repo: string, workflow: string, ref: string): Promise<{ runId: number }>;
}

export class FakeGitHubApi implements GitHubApi {
  private prSeq = 100;
  private runSeq = 5000;
  readonly created: { prs: GhPullRequest[]; runs: { repo: string; workflow: string; ref: string }[] } = {
    prs: [],
    runs: [],
  };

  async listRepositories(org?: string): Promise<GhRepo[]> {
    const all: GhRepo[] = [
      { id: 1, fullName: 'havitec/techit', defaultBranch: 'main' },
      { id: 2, fullName: 'havitec/frontend', defaultBranch: 'main' },
    ];
    return org ? all.filter((r) => r.fullName.startsWith(`${org}/`)) : all;
  }

  async readFile(_repo: string, path: string, ref = 'main'): Promise<string> {
    return `// ${path} @ ${ref}\nexport const hello = 'world';\n`;
  }

  async listIssues(_repo: string, state = 'open'): Promise<GhIssue[]> {
    return [{ number: 7, title: 'Wire up audit log', state: state as 'open' | 'closed' }];
  }

  async getPrStatus(_repo: string, num: number): Promise<GhPrStatus> {
    return {
      number: num,
      mergeable: true,
      checks: [{ name: 'ci', conclusion: 'success' }],
    };
  }

  async createPullRequest(input: {
    repo: string;
    head: string;
    base: string;
    title: string;
    body?: string;
  }): Promise<GhPullRequest> {
    this.prSeq += 1;
    const pr: GhPullRequest = {
      number: this.prSeq,
      repo: input.repo,
      title: input.title,
      head: input.head,
      base: input.base,
      state: 'open',
    };
    this.created.prs.push(pr);
    return pr;
  }

  async runWorkflow(repo: string, workflow: string, ref: string): Promise<{ runId: number }> {
    this.runSeq += 1;
    this.created.runs.push({ repo, workflow, ref });
    return { runId: this.runSeq };
  }
}
