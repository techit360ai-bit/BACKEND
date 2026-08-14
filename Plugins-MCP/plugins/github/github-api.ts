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

export class RealGitHubApi implements GitHubApi {
  private static readonly BASE = 'https://api.github.com';

  constructor(
    private readonly token: string | (() => Promise<string>),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = typeof this.token === 'function' ? await this.token() : this.token;
    if (!token) throw new Error('github connector token is unavailable');
    const res = await this.fetchImpl(`${RealGitHubApi.BASE}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`github api ${res.status}: ${detail.slice(0, 300)}`);
    }
    if (res.status === 204) return undefined as T;
    return await res.json() as T;
  }

  async listRepositories(org?: string): Promise<GhRepo[]> {
    const path = org
      ? `/orgs/${encodeURIComponent(org)}/repos?per_page=100&type=all`
      : '/user/repos?per_page=100&affiliation=owner,collaborator,organization_member';
    const rows = await this.request<{ id: number; full_name: string; default_branch: string }[]>(path);
    return rows.map((row) => ({ id: row.id, fullName: row.full_name, defaultBranch: row.default_branch }));
  }

  async readFile(repo: string, path: string, ref = 'main'): Promise<string> {
    const data = await this.request<{ content?: string; encoding?: string }>(
      `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
    );
    if (data.encoding !== 'base64' || !data.content) throw new Error('github file response was not base64 content');
    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  }

  async listIssues(repo: string, state = 'open'): Promise<GhIssue[]> {
    const rows = await this.request<{ number: number; title: string; state: string; pull_request?: unknown }[]>(
      `/repos/${repo}/issues?state=${encodeURIComponent(state)}&per_page=100`,
    );
    return rows.filter((row) => !row.pull_request).map((row) => ({
      number: row.number, title: row.title, state: row.state === 'closed' ? 'closed' : 'open',
    }));
  }

  async getPrStatus(repo: string, num: number): Promise<GhPrStatus> {
    const pr = await this.request<{ mergeable: boolean | null; head: { sha: string } }>(`/repos/${repo}/pulls/${num}`);
    const checks = await this.request<{ check_runs: { name: string; conclusion: string | null; status: string }[] }>(
      `/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`,
    );
    return {
      number: num,
      mergeable: pr.mergeable === true,
      checks: checks.check_runs.map((check) => ({
        name: check.name,
        conclusion: check.status !== 'completed' ? 'pending' : check.conclusion === 'success' ? 'success' : 'failure',
      })),
    };
  }

  async createPullRequest(input: {
    repo: string; head: string; base: string; title: string; body?: string;
  }): Promise<GhPullRequest> {
    const row = await this.request<{ number: number; title: string; head: { ref: string }; base: { ref: string }; state: string }>(
      `/repos/${input.repo}/pulls`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    return {
      number: row.number, repo: input.repo, title: row.title, head: row.head.ref,
      base: row.base.ref, state: row.state === 'closed' ? 'closed' : 'open',
    };
  }

  async runWorkflow(repo: string, workflow: string, ref: string): Promise<{ runId: number }> {
    await this.request(`/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
      method: 'POST', body: JSON.stringify({ ref }),
    });
    return { runId: 0 };
  }
}
