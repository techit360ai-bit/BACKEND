import { BaseMCPServer, type ManifestMCPTool, type SdkRuntime } from '@techit/plugin-sdk'
import type { GitHostApi } from './git-host-api.js'

const BLOCKED = /(^|\/)(\.env($|\.)|\.git(?:\/|$)|node_modules(?:\/|$)|\.ssh(?:\/|$)|secrets?(?:\/|$)|credentials?(?:\/|$)|[^/]*(?:credential|secret|private[-_]?key)[^/]*\.(?:json|pem|key|txt)$)/i
const safePath = (value: unknown) => { const path = String(value || '').trim().replaceAll('\\', '/').replace(/^\.\//, ''); return path && !path.startsWith('/') && !path.includes('\0') && !path.split('/').includes('..') && !BLOCKED.test(path) ? path : null }

export class GitHostMCPServer extends BaseMCPServer {
  constructor(name: string, runtime: SdkRuntime, tools: ManifestMCPTool[], api: GitHostApi) {
    super(name, runtime, tools)
    this.handle('get_repository_state', p => api.getRepositoryState(String(p.repo), String(p.branch || 'main')))
    this.handle('read_file', p => { const path = safePath(p.path); if (!path) throw new Error('unsafe or sensitive path'); return api.readFile(String(p.repo), path, String(p.ref || 'main')) })
    this.handle('get_commit_checks', p => api.getCommitChecks(String(p.repo), String(p.commitSha)))
    this.handle('push_files', p => { const files = Array.isArray(p.files) ? p.files as Record<string, unknown>[] : []; if (!files.length || files.length > 200) throw new Error('push_files requires 1-200 changes'); const normalized = files.map(file => ({ path: safePath(file.path), content: file.content === undefined ? undefined : String(file.content), delete: file.delete === true })); if (normalized.some(file => !file.path) || normalized.reduce((sum, file) => sum + Buffer.byteLength(file.content || '', 'utf8'), 0) > 2_000_000) throw new Error('unsafe or oversized push'); return api.pushFiles({ repo: String(p.repo), branch: String(p.branch), expectedHeadSha: String(p.expectedHeadSha), message: String(p.message), files: normalized as { path: string; content?: string; delete?: boolean }[] }) }, 'code_commit', (params, data) => { const row = data as { commitSha?: string; filesChanged?: number }; return { projectId: params.projectId ? String(params.projectId) : undefined, artifactId: row.commitSha ? `${name}:commit:${row.commitSha}` : undefined, weight: Math.max(1, Math.min(5, Number(row.filesChanged || 1))), metadata: data as Record<string, unknown> } })
  }
}
