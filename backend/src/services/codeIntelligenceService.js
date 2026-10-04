// codeIntelligenceService.js
//
// Coding-area intelligence for the workspace Code page.
//
// Design rules:
//  - The *plan* is deterministic and derived from real, stored project state
//    (projectFiles snapshot + detected adapter + the requirement text). It never
//    invents file names or scores, and it works with no AI provider configured.
//  - The *proposal* (actual code text) requires the AI router. When the router is
//    unavailable or returns something we cannot validate, we return an explicit
//    error instead of fabricating code.
//  - Both report the model routing they requested (`ai_routing`), including when
//    a personal (BYOK) connection was selected but the router can only serve a
//    platform model. That gap is disclosed, never hidden.

import { readDb as readAuthorityDb } from '../config/database.js'
import { codeWorkspaceAccess, codeWorkspaceSnapshot, detectProjectAdapter, safeCodePath } from './codeWorkspaceService.js'
import { requestWorkspaceConversation } from './aiRouterClient.js'

const rows = (db, name) => (Array.isArray(db[name]) ? db[name] : [])

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'with', 'that', 'this', 'it', 'is', 'be',
  'add', 'make', 'build', 'create', 'update', 'change', 'fix', 'should', 'must', 'need', 'please', 'using', 'use',
  'new', 'also', 'then', 'when', 'from', 'into', 'about', 'can', 'will', 'file', 'code',
])

function keywords(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9_.-]{2,}/g) || []
  return [...new Set(words)].filter(word => !STOPWORDS.has(word)).slice(0, 24)
}

function scoreFiles(files, terms) {
  return files
    .map(file => {
      const path = String(file.path || '').toLowerCase()
      const content = String(file.content || '').toLowerCase()
      const matched = terms.filter(term => path.includes(term) || content.includes(term))
      const score = matched.reduce((sum, term) => sum + (path.includes(term) ? 3 : 1), 0)
      return { file, score, matched }
    })
    .sort((a, b) => b.score - a.score || String(a.file.path).localeCompare(String(b.file.path)))
}

function existingSystems(files, adapter) {
  const systems = []
  const paths = files.map(file => String(file.path || '').toLowerCase())
  const name = adapter?.adapter
  if (name === 'react' || name === 'nextjs' || paths.some(path => path.endsWith('.tsx') || path.endsWith('.jsx'))) systems.push('React UI')
  if (paths.some(path => path === 'package.json' || path.endsWith('/package.json'))) systems.push('Node package')
  if (paths.some(path => path.endsWith('.py'))) systems.push('Python')
  if (paths.some(path => /(^|\/)(drizzle|prisma|migrations?)\//.test(path))) systems.push('Database migrations')
  if (name) systems.push(`${name} adapter`)
  return [...new Set(systems)]
}

/**
 * Which model routing the caller asked for, and what the AI router can actually honour.
 * The router currently only accepts `model_id` for platform models, so a bound BYOK
 * connection is recorded and disclosed but served by the platform model.
 */
export function resolveWorkspaceRouting(userId, workspaceId) {
  const db = readAuthorityDb()
  const binding = rows(db, 'workspaceModelBindings').find(row =>
    row.workspaceId === workspaceId && row.userId === userId && row.status === 'active')
  if (!binding) return { requested: 'platform', applied: 'platform', reason: null, connectionId: null, connectionName: null, modelId: null }
  const connection = rows(db, 'userModelConnections').find(row => row.id === binding.connectionId && row.status === 'active')
  if (!connection) return { requested: 'platform', applied: 'platform', reason: 'bound_connection_not_active', connectionId: null, connectionName: null, modelId: null }
  return {
    requested: 'byok',
    applied: 'platform',
    reason: 'byok_not_supported_by_ai_router',
    connectionId: connection.id,
    connectionName: connection.displayName || connection.provider,
    modelId: binding.modelId || null,
  }
}

function requireAccess(userId, workspaceId) {
  const db = readAuthorityDb()
  const access = codeWorkspaceAccess(db, userId, workspaceId)
  if (!access) return { ok: false, status: 403, error: 'workspace_access_denied' }
  return { ok: true, access }
}

function buildPlan(userId, workspaceId, body) {
  const snapshot = codeWorkspaceSnapshot(userId, workspaceId)
  if (!snapshot.ok) return snapshot
  const adapterResult = detectProjectAdapter(userId, workspaceId)
  const adapter = adapterResult.ok ? adapterResult : null
  const files = snapshot.files || []
  const requirement = String(body.requirement || '').slice(0, 8000)
  const terms = keywords(requirement)
  const ranked = scoreFiles(files, terms).filter(row => row.score > 0)
  const activePath = safeCodePath(body.active_file)
  const fallback = files.find(file => file.path === activePath) || files[0]

  const selected = ranked.slice(0, 3).map(row => ({
    path: row.file.path,
    action: files.some(file => file.path === row.file.path) ? 'modify' : 'create',
    reason: row.matched.length
      ? `Matches the request: ${row.matched.slice(0, 4).join(', ')}`
      : 'Selected from the current workspace snapshot',
  }))
  if (selected.length === 0 && fallback) {
    selected.push({ path: fallback.path, action: 'modify', reason: 'No file name matched the request; the active workspace file is the safest starting point.' })
  }

  const blocked = files.filter(file => !safeCodePath(file.path)).map(file => file.path)
  const securityChecks = ['Every proposed path is re-validated against the workspace path-safety rules before it is written.']
  if (blocked.length) securityChecks.push(`${blocked.length} stored path(s) are blocked by the path-safety rules and are excluded.`)
  if (/\b(auth|token|password|secret|payment|billing|permission)\b/i.test(requirement)) {
    securityChecks.push('The request touches authentication, secrets or payments — review authorization and secret handling on every touched path.')
  }

  const tests = []
  if (adapter?.commands?.test) tests.push(adapter.commands.test)
  if (files.some(file => /\.(test|spec)\.[a-z]+$/i.test(file.path))) tests.push('Update the existing co-located test files for every changed module.')

  const mode = String(body.mode || 'assist')
  const flow = mode === 'manual'
    ? ['Plan']
    : mode === 'autonomous'
      ? ['Plan', 'Code', 'Test', 'Debugger', 'Security', 'Review', 'Apply']
      : ['Plan', 'Code', 'Review', 'Apply']

  const summary = files.length === 0
    ? 'This workspace has no stored project files yet, so there is nothing to change. Create or pull files first.'
    : `Plan derived from ${files.length} stored file(s)${adapter?.adapter ? ` and the ${adapter.adapter} adapter` : ''}. ${selected.length ? `${selected.length} file(s) would change.` : 'No file matched the request.'}`

  return {
    ok: true,
    plan: {
      summary,
      existingSystems: existingSystems(files, adapter),
      changes: selected,
      tests,
      securityChecks,
      recommendedAgentFlow: flow,
    },
    context_injected: files.length > 0,
    authoritative: false,
    ai_routing: resolveWorkspaceRouting(userId, workspaceId),
  }
}

export async function planCodeTask(userId, workspaceId, body, token) {
  const guard = requireAccess(userId, workspaceId)
  if (!guard.ok) return guard
  const result = buildPlan(userId, workspaceId, body)
  if (!result.ok) return result
  if (body.use_ai !== true) return result

  const narrative = await requestWorkspaceConversation(token, {
    workspace_id: workspaceId,
    message: `In at most 4 sentences, describe the implementation approach for: ${String(body.requirement || '').slice(0, 2000)}. Name the files that would change. Do not invent file names that were not listed.`,
  })
  return { ...result, plan: { ...result.plan, aiNarrative: narrative?.message || null, aiModel: narrative?.model_used || null } }
}

function extractJson(text) {
  const value = String(text || '')
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : value).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try { return JSON.parse(candidate.slice(start, end + 1)) } catch { return null }
}

export async function proposeCodeChanges(userId, workspaceId, body, token) {
  const guard = requireAccess(userId, workspaceId)
  if (!guard.ok) return guard
  const snapshot = codeWorkspaceSnapshot(userId, workspaceId)
  if (!snapshot.ok) return snapshot
  const plan = buildPlan(userId, workspaceId, body)
  if (!plan.ok) return plan
  if (!plan.plan.changes.length) return { ok: false, status: 409, error: 'no_target_files', detail: 'No workspace file matched the request.' }

  const targets = plan.plan.changes
    .map(change => snapshot.files.find(file => file.path === change.path))
    .filter(Boolean)
  const context = targets.map(file => `### ${file.path}\n${String(file.content || '').slice(0, 12000)}`).join('\n\n')

  const response = await requestWorkspaceConversation(token, {
    workspace_id: workspaceId,
    message: [
      'Return ONLY strict JSON matching this shape:',
      '{"summary": string, "changes": [{"path": string, "content": string, "reason": string}], "tests": string[], "securityNotes": string[]}',
      'Only include paths from the file list below. `content` must be the complete new file contents.',
      '',
      `Requirement: ${String(body.requirement || '').slice(0, 4000)}`,
      '',
      `Files:\n${context}`,
    ].join('\n'),
  })
  if (!response) return { ok: false, status: 503, error: 'ai_router_unavailable', detail: 'The AI router did not answer, so no code was generated.' }

  const parsed = extractJson(response.message)
  if (!parsed || !Array.isArray(parsed.changes)) {
    return { ok: false, status: 502, error: 'ai_proposal_unparseable', detail: 'The AI router did not return a machine-readable proposal.' }
  }

  const allowed = new Set(snapshot.files.map(file => file.path))
  const changes = []
  for (const change of parsed.changes.slice(0, 40)) {
    const path = safeCodePath(change?.path)
    if (!path || !allowed.has(path) || typeof change?.content !== 'string') continue
    changes.push({ path, content: change.content, reason: String(change.reason || '').slice(0, 500) })
  }
  if (changes.length === 0) {
    return { ok: false, status: 502, error: 'ai_proposal_rejected', detail: 'The AI proposal referenced no valid workspace file path.' }
  }
  return {
    ok: true,
    proposal: {
      summary: String(parsed.summary || plan.plan.summary).slice(0, 2000),
      changes,
      tests: Array.isArray(parsed.tests) ? parsed.tests.slice(0, 20).map(String) : plan.plan.tests,
      securityNotes: Array.isArray(parsed.securityNotes) ? parsed.securityNotes.slice(0, 20).map(String) : plan.plan.securityChecks,
    },
    authoritative: false,
    applied: false,
    ai_routing: plan.ai_routing,
    ai_model: response.model_used || null,
  }
}

export async function orchestrateCodeTask(userId, workspaceId, body) {
  const guard = requireAccess(userId, workspaceId)
  if (!guard.ok) return guard
  const plan = buildPlan(userId, workspaceId, body)
  if (!plan.ok) return plan

  const changeActions = plan.plan.changes.map(change => `${change.action} ${change.path}`)
  // The three planning stages use the execution-run vocabulary so the console can
  // record them directly. The remaining flow is returned as `recommendedFlow` and
  // is NOT recorded here: those stages only happen when the work actually runs.
  const stages = [
    {
      stage: 'execution_intelligence',
      agent: 'ExecutionIntelligenceAgent',
      summary: plan.plan.summary,
      actions: [],
      risks: [],
      requiresEvidence: [],
    },
    {
      stage: 'mvp_builder',
      agent: 'MvpBuilderAgent',
      summary: changeActions.length
        ? `Bounded implementation touching ${changeActions.length} file(s): ${changeActions.join(', ')}.`
        : 'No workspace file matched the request, so no build step is scheduled.',
      actions: changeActions,
      risks: [],
      requiresEvidence: plan.plan.tests,
    },
    {
      stage: 'product_architect',
      agent: 'ProductArchitectAgent',
      summary: plan.plan.existingSystems.length
        ? `Existing systems in scope: ${plan.plan.existingSystems.join(', ')}.`
        : 'No established framework was detected in the current file set.',
      actions: plan.plan.existingSystems,
      risks: plan.plan.securityChecks,
      requiresEvidence: [],
    },
  ]
  return {
    ok: true,
    orchestration: { summary: plan.plan.summary, stages, recommendedFlow: plan.plan.recommendedAgentFlow },
    authoritative: false,
    execution: { performed: false, requires_backend_run: true, requires_mcp: true, mutation_free: true },
    ai_routing: plan.ai_routing,
  }
}
