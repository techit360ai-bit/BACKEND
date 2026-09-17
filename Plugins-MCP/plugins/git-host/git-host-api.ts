export interface GitHostFileChange { path: string; content?: string; delete?: boolean }
export interface GitHostState { repo: string; branch: string; headSha: string; treeSha: string; files: { path: string; sha: string; size: number }[] }
export interface GitHostPush { repo: string; branch: string; previousHeadSha: string; commitSha: string; commitUrl: string; message: string; filesChanged: number }
export interface GitHostChecks { commitSha: string; providerStatus: 'success' | 'failure' | 'pending'; checks: { name: string; conclusion: 'success' | 'failure' | 'pending' }[]; url: string }
export interface GitHostApi {
  getRepositoryState(repo: string, branch: string): Promise<GitHostState>
  readFile(repo: string, path: string, ref: string): Promise<string>
  pushFiles(input: { repo: string; branch: string; expectedHeadSha: string; message: string; files: GitHostFileChange[] }): Promise<GitHostPush>
  getCommitChecks(repo: string, commitSha: string): Promise<GitHostChecks>
}

export class FakeGitHostApi implements GitHostApi {
  private version = 1
  constructor(private readonly provider: 'gitlab' | 'bitbucket') {}
  async getRepositoryState(repo: string, branch: string): Promise<GitHostState> { return { repo, branch, headSha: `${this.provider}-head-${this.version}`, treeSha: `${this.provider}-tree-${this.version}`, files: [{ path: 'README.md', sha: 'readme', size: 20 }] } }
  async readFile(_repo: string, path: string, ref: string): Promise<string> { return `// ${path} @ ${ref}\n` }
  async pushFiles(input: { repo: string; branch: string; expectedHeadSha: string; message: string; files: GitHostFileChange[] }): Promise<GitHostPush> { const state = await this.getRepositoryState(input.repo, input.branch); if (state.headSha !== input.expectedHeadSha) throw new Error(`${this.provider} conflict: remote head changed`); this.version += 1; const commitSha = `${this.provider}-head-${this.version}`; return { repo: input.repo, branch: input.branch, previousHeadSha: state.headSha, commitSha, commitUrl: `https://${this.provider}.com/${input.repo}/commits/${commitSha}`, message: input.message, filesChanged: input.files.length } }
  async getCommitChecks(_repo: string, commitSha: string): Promise<GitHostChecks> { return { commitSha, providerStatus: 'success', checks: [{ name: 'pipeline', conclusion: 'success' }], url: `https://${this.provider}.com/pipelines/${commitSha}` } }
}

abstract class HttpGitHostApi implements GitHostApi {
  constructor(protected readonly token: () => Promise<string>, protected readonly fetchImpl: typeof fetch = fetch) {}
  protected async json<T>(url: string, init: RequestInit = {}): Promise<T> { const token = await this.token(); const response = await this.fetchImpl(url, { ...init, headers: { ...this.headers(token), ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) } }); if (!response.ok) throw new Error(`git provider api ${response.status}: ${(await response.text().catch(() => '')).slice(0, 300)}`); return response.status === 204 ? undefined as T : await response.json() as T }
  protected abstract headers(token: string): Record<string, string>
  abstract getRepositoryState(repo: string, branch: string): Promise<GitHostState>
  abstract readFile(repo: string, path: string, ref: string): Promise<string>
  abstract pushFiles(input: { repo: string; branch: string; expectedHeadSha: string; message: string; files: GitHostFileChange[] }): Promise<GitHostPush>
  abstract getCommitChecks(repo: string, commitSha: string): Promise<GitHostChecks>
}

export class RealGitLabApi extends HttpGitHostApi {
  private base = 'https://gitlab.com/api/v4'
  protected headers(token: string) { return { authorization: `Bearer ${token}` } }
  private project(repo: string) { return encodeURIComponent(repo) }
  async getRepositoryState(repo: string, branch: string): Promise<GitHostState> { const project = this.project(repo); const ref = await this.json<{ commit: { id: string } }>(`${this.base}/projects/${project}/repository/branches/${encodeURIComponent(branch)}`); const tree = await this.json<{ path: string; id: string; type: string }[]>(`${this.base}/projects/${project}/repository/tree?ref=${encodeURIComponent(ref.commit.id)}&recursive=true&per_page=100`); return { repo, branch, headSha: ref.commit.id, treeSha: ref.commit.id, files: tree.filter(row => row.type === 'blob').map(row => ({ path: row.path, sha: row.id, size: 0 })) } }
  async readFile(repo: string, path: string, ref: string): Promise<string> { const response = await this.fetchImpl(`${this.base}/projects/${this.project(repo)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`, { headers: this.headers(await this.token()) }); if (!response.ok) throw new Error(`gitlab read failed: ${response.status}`); return response.text() }
  async pushFiles(input: { repo: string; branch: string; expectedHeadSha: string; message: string; files: GitHostFileChange[] }): Promise<GitHostPush> { const state = await this.getRepositoryState(input.repo, input.branch); if (state.headSha !== input.expectedHeadSha) throw new Error('gitlab conflict: remote head changed'); const existing = new Set(state.files.map(row => row.path)); const commit = await this.json<{ id: string; web_url: string }>(`${this.base}/projects/${this.project(input.repo)}/repository/commits`, { method: 'POST', body: JSON.stringify({ branch: input.branch, commit_message: input.message, last_commit_id: state.headSha, actions: input.files.map(file => ({ action: file.delete ? 'delete' : existing.has(file.path) ? 'update' : 'create', file_path: file.path, content: file.content })) }) }); return { repo: input.repo, branch: input.branch, previousHeadSha: state.headSha, commitSha: commit.id, commitUrl: commit.web_url, message: input.message, filesChanged: input.files.length } }
  async getCommitChecks(repo: string, commitSha: string): Promise<GitHostChecks> { const rows = await this.json<{ id: number; status: string; web_url: string }[]>(`${this.base}/projects/${this.project(repo)}/pipelines?sha=${encodeURIComponent(commitSha)}&per_page=20`); const checks = rows.map(row => ({ name: `pipeline-${row.id}`, conclusion: row.status === 'success' ? 'success' as const : ['failed', 'canceled'].includes(row.status) ? 'failure' as const : 'pending' as const })); return { commitSha, providerStatus: checks.length && checks.every(row => row.conclusion === 'success') ? 'success' : checks.some(row => row.conclusion === 'failure') ? 'failure' : 'pending', checks, url: rows[0]?.web_url || `https://gitlab.com/${repo}/-/pipelines` } }
}

export class RealBitbucketApi extends HttpGitHostApi {
  private base = 'https://api.bitbucket.org/2.0'
  protected headers(token: string) { return { authorization: `Bearer ${token}` } }
  async getRepositoryState(repo: string, branch: string): Promise<GitHostState> { const ref = await this.json<{ target: { hash: string } }>(`${this.base}/repositories/${repo}/refs/branches/${encodeURIComponent(branch)}`); const tree = await this.json<{ values: { path: string; type: string; commit?: { hash: string }; size?: number }[] }>(`${this.base}/repositories/${repo}/src/${ref.target.hash}/?pagelen=100`); return { repo, branch, headSha: ref.target.hash, treeSha: ref.target.hash, files: tree.values.filter(row => row.type === 'commit_file').map(row => ({ path: row.path, sha: row.commit?.hash || ref.target.hash, size: Number(row.size || 0) })) } }
  async readFile(repo: string, path: string, ref: string): Promise<string> { const response = await this.fetchImpl(`${this.base}/repositories/${repo}/src/${encodeURIComponent(ref)}/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: this.headers(await this.token()) }); if (!response.ok) throw new Error(`bitbucket read failed: ${response.status}`); return response.text() }
  async pushFiles(input: { repo: string; branch: string; expectedHeadSha: string; message: string; files: GitHostFileChange[] }): Promise<GitHostPush> { const state = await this.getRepositoryState(input.repo, input.branch); if (state.headSha !== input.expectedHeadSha) throw new Error('bitbucket conflict: remote head changed'); const body = new FormData(); body.set('branch', input.branch); body.set('message', input.message); body.set('parents', state.headSha); for (const file of input.files) file.delete ? body.append('files', file.path) : body.append(file.path, new Blob([file.content || ''], { type: 'text/plain' }), pathName(file.path)); const commit = await this.json<{ hash: string; links: { html: { href: string } } }>(`${this.base}/repositories/${input.repo}/src`, { method: 'POST', body }); return { repo: input.repo, branch: input.branch, previousHeadSha: state.headSha, commitSha: commit.hash, commitUrl: commit.links.html.href, message: input.message, filesChanged: input.files.length } }
  async getCommitChecks(repo: string, commitSha: string): Promise<GitHostChecks> { const rows = await this.json<{ values: { uuid: string; state: { name: string; result?: { name: string } }; links: { html: { href: string } } }[] }>(`${this.base}/repositories/${repo}/pipelines/?target.commit.hash=${encodeURIComponent(commitSha)}&pagelen=20`); const checks = rows.values.map(row => ({ name: `pipeline-${row.uuid}`, conclusion: row.state.name === 'COMPLETED' && row.state.result?.name === 'SUCCESSFUL' ? 'success' as const : row.state.name === 'COMPLETED' ? 'failure' as const : 'pending' as const })); return { commitSha, providerStatus: checks.length && checks.every(row => row.conclusion === 'success') ? 'success' : checks.some(row => row.conclusion === 'failure') ? 'failure' : 'pending', checks, url: rows.values[0]?.links.html.href || `https://bitbucket.org/${repo}/pipelines` } }
}

function pathName(value: string) { return value.split('/').pop() || 'file' }
