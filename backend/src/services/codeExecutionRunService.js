import crypto from 'node:crypto'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { appendCodeEvent, codeWorkspaceAccess, safeCodePath } from './codeWorkspaceService.js'

const STAGES = ['execution_intelligence', 'mvp_builder', 'product_architect', 'code', 'test', 'debugger', 'security', 'review', 'deployment']
const REQUIRED_READY_STAGES = ['execution_intelligence', 'product_architect', 'code', 'test', 'security', 'review']
const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex')

function applyLineHunks(content, hunks, acceptedIds = null) {
  const lines = String(content).split('\n')
  const selected = hunks
    .filter(hunk => acceptedIds === null || acceptedIds.has(hunk.id))
    .sort((a, b) => b.oldStart - a.oldStart || b.oldEnd - a.oldEnd)
  let previousStart = lines.length + 1
  for (const hunk of selected) {
    if (!Number.isInteger(hunk.oldStart) || !Number.isInteger(hunk.oldEnd) || hunk.oldStart < 0 || hunk.oldEnd < hunk.oldStart || hunk.oldEnd > lines.length || hunk.oldEnd > previousStart) throw new Error('execution_hunk_range_invalid')
    lines.splice(hunk.oldStart, hunk.oldEnd - hunk.oldStart, ...(hunk.replacement === '' ? [] : hunk.replacement.split('\n')))
    previousStart = hunk.oldStart
  }
  return lines.join('\n')
}

function normalizeProposedChange(db, run, item) {
  const path = safeCodePath(item?.path)
  const current = rows(db, 'projectFiles').find(row => row.workspaceId === run.workspaceId && row.path === path && !row.deleted)
  const contentHash = String(item?.contentHash || '')
  const hunks = Array.isArray(item?.hunks) ? item.hunks.slice(0, 500).map((hunk, index) => ({
    id: String(hunk?.id || `hunk-${index + 1}`).slice(0, 100),
    oldStart: Number(hunk?.oldStart), oldEnd: Number(hunk?.oldEnd),
    replacement: String(hunk?.replacement || ''),
    replacementHash: hash(String(hunk?.replacement || '')),
  })) : []
  if (hunks.some(hunk => Buffer.byteLength(hunk.replacement, 'utf8') > 1_000_000) || new Set(hunks.map(hunk => hunk.id)).size !== hunks.length) throw new Error('execution_hunk_invalid')
  if (hunks.length) {
    const baseline = String(current?.content || '')
    if (String(item?.baseContentHash || hash(baseline)) !== hash(baseline)) throw new Error('execution_hunk_baseline_invalid')
    if (hash(applyLineHunks(baseline, hunks)) !== contentHash) throw new Error('execution_hunk_content_mismatch')
  }
  return { path, contentHash, baseContentHash: hash(String(current?.content || '')), hunks, reason: String(item?.reason || '').slice(0, 1000) }
}

function latestSteps(db, runId) {
  const latest = new Map()
  for (const row of rows(db, 'codeExecutionStepEvents').filter(item => item.runId === runId)) latest.set(row.stage, row)
  return STAGES.map(stage => latest.get(stage) || { stage, status: 'pending' })
}

function latestReviews(db, runId) {
  const latest = new Map()
  for (const row of rows(db, 'codeReviewDecisions').filter(item => item.runId === runId)) latest.set(row.path, row)
  return [...latest.values()]
}

function runView(db, run) {
  return { ...run, steps: latestSteps(db, run.id), reviews: latestReviews(db, run.id) }
}

export function createCodeExecutionRun(userId, workspaceId, body = {}) {
  const requirement = String(body.requirement || '').trim()
  if (!requirement) return { ok: false, status: 400, error: 'requirement_required' }
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const currentFiles = rows(db, 'projectFiles').filter(row => row.workspaceId === workspaceId && !row.deleted)
    const requestedPaths = Array.isArray(body.allowedPaths) ? body.allowedPaths : currentFiles.map(row => row.path)
    const allowedPaths = [...new Set(requestedPaths.slice(0, 100).map(safeCodePath).filter(Boolean))]
    const adapter = String(body.adapter || 'static').slice(0, 40)
    const allowedCommands = [...new Set((Array.isArray(body.allowedCommands) ? body.allowedCommands : []).slice(0, 10).map(value => String(value).slice(0, 300)))]
    const createdAt = nowIso()
    const run = {
      id: createId('code_run'), workspaceId, projectId: auth.workspace.projectId, actorId: userId,
      requirement: requirement.slice(0, 10000), mode: ['suggest', 'execute', 'autonomous'].includes(body.mode) ? body.mode : 'suggest',
      adapter, allowedPaths, allowedCommands,
      budget: { maxFiles: Math.min(100, Math.max(1, Number(body.maxFiles || 40))), maxSteps: Math.min(20, Math.max(1, Number(body.maxSteps || 12))), timeoutMs: Math.min(1_200_000, Math.max(30_000, Number(body.timeoutMs || 600_000))) },
      baseline: currentFiles.filter(row => allowedPaths.includes(row.path)).map(row => ({ path: row.path, version: row.version, contentHash: row.contentHash })),
      proposedChanges: [], status: 'planned', createdAt, updatedAt: createdAt,
    }
    rows(db, 'codeExecutionRuns').push(run)
    appendCodeEvent(db, { workspaceId, projectId: run.projectId, actorId: userId, type: 'execution_run_created', executionRunId: run.id, metadata: { mode: run.mode, allowedPaths, budget: run.budget } })
    return { ok: true, run: runView(db, run) }
  })
}

export function getCodeExecutionRun(userId, workspaceId, runId) {
  const db = readAuthorityDb(); if (!codeWorkspaceAccess(db, userId, workspaceId)) return { ok: false, status: 403, error: 'workspace_access_denied' }
  const run = rows(db, 'codeExecutionRuns').find(row => row.id === runId && row.workspaceId === workspaceId)
  return run ? { ok: true, run: runView(db, run) } : { ok: false, status: 404, error: 'execution_run_not_found' }
}

export function recordCodeExecutionStage(userId, workspaceId, runId, body = {}) {
  const stage = String(body.stage || '')
  const status = String(body.status || '')
  if (!STAGES.includes(stage) || !['started', 'completed', 'failed', 'skipped'].includes(status)) return { ok: false, status: 400, error: 'execution_stage_invalid' }
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const run = rows(db, 'codeExecutionRuns').find(row => row.id === runId && row.workspaceId === workspaceId); if (!run) return { ok: false, status: 404, error: 'execution_run_not_found' }
    const previous = latestSteps(db, runId).find(row => row.stage === stage)
    const stepEvents = rows(db, 'codeExecutionStepEvents').filter(row => row.runId === runId)
    if (stepEvents.length >= run.budget.maxSteps) return { ok: false, status: 409, error: 'execution_step_budget_exhausted' }
    const latestDebugger = latestSteps(db, runId).find(row => row.stage === 'debugger')
    const latestCode = latestSteps(db, runId).find(row => row.stage === 'code')
    const previousIndex = previous?.id ? stepEvents.findIndex(row => row.id === previous.id) : -1
    const repeatAllowed = stage === 'code' && latestDebugger?.status === 'completed' && stepEvents.findIndex(row => row.id === latestDebugger.id) > previousIndex
      || ['test', 'security'].includes(stage) && latestCode?.status === 'completed' && stepEvents.findIndex(row => row.id === latestCode.id) > previousIndex
    if ((previous?.status === 'completed' || previous?.status === 'skipped') && !repeatAllowed) return { ok: false, status: 409, error: 'execution_stage_already_final' }
    if (previous?.status === 'failed' && stage === 'test' && !repeatAllowed) return { ok: false, status: 409, error: 'debugged_code_required_before_test_retry' }
    let evidence = body.evidence && typeof body.evidence === 'object' && !Array.isArray(body.evidence) ? body.evidence : {}
    if (stage === 'code' && status === 'completed') {
      const changes = Array.isArray(body.changes) ? body.changes.slice(0, run.budget.maxFiles) : []
      let normalized
      try { normalized = changes.map(item => normalizeProposedChange(db, run, item)).filter(item => item.path && run.allowedPaths.includes(item.path) && /^[a-f0-9]{64}$/i.test(item.contentHash)) }
      catch (error) { return { ok: false, status: 400, error: error instanceof Error ? error.message : 'execution_hunk_invalid' } }
      if (normalized.length !== changes.length) return { ok: false, status: 400, error: 'execution_proposal_out_of_scope' }
      run.proposedChanges = normalized
      evidence = { ...evidence, proposedFiles: normalized.length }
    }
    if (stage === 'test' && status === 'completed') {
      const session = rows(db, 'codeRuntimeSessions').find(row => row.id === body.runtimeSessionId && row.workspaceId === workspaceId && row.status === 'completed' && Number(row.exitCode) === 0)
      if (!session) return { ok: false, status: 409, error: 'passing_test_evidence_required' }
      evidence = { ...evidence, runtimeSessionId: session.id }
    }
    if (stage === 'security' && status === 'completed') {
      const scan = scanCodeChanges(body.changes || [])
      if (scan.critical > 0) return { ok: false, status: 409, error: 'critical_security_findings', scan }
      evidence = { ...evidence, scan }
    }
    if (stage === 'review' && status === 'completed') {
      const reviews = latestReviews(db, runId)
      if (!run.proposedChanges.length || run.proposedChanges.some(change => !reviews.some(review => review.path === change.path && review.decision === 'accepted' && review.contentHash === change.contentHash))) return { ok: false, status: 409, error: 'accepted_review_required' }
      evidence = { ...evidence, acceptedFiles: reviews.filter(row => row.decision === 'accepted').length }
    }
    const createdAt = nowIso()
    const row = { id: createId('code_step'), runId, workspaceId, projectId: run.projectId, actorId: userId, stage, agent: String(body.agent || stage).slice(0, 100), status, summary: String(body.summary || '').slice(0, 4000), evidenceHash: hash(JSON.stringify(evidence)), evidence, createdAt }
    rows(db, 'codeExecutionStepEvents').push(row)
    run.updatedAt = createdAt; run.status = status === 'failed' ? 'failed' : 'running'
    appendCodeEvent(db, { workspaceId, projectId: run.projectId, actorId: userId, type: `execution_stage_${status}`, executionRunId: runId, metadata: { stage, stepEventId: row.id, evidenceHash: row.evidenceHash } })
    return { ok: true, run: runView(db, run), step: row }
  })
}

export function recordCodeReviewDecision(userId, workspaceId, runId, body = {}) {
  const path = safeCodePath(body.path); const decision = String(body.decision || '')
  if (!path || !['accepted', 'rejected'].includes(decision) || !/^[a-f0-9]{64}$/i.test(String(body.contentHash || ''))) return { ok: false, status: 400, error: 'review_decision_invalid' }
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const run = rows(db, 'codeExecutionRuns').find(row => row.id === runId && row.workspaceId === workspaceId); if (!run) return { ok: false, status: 404, error: 'execution_run_not_found' }
    if (!run.proposedChanges.some(change => change.path === path && change.contentHash === body.contentHash)) return { ok: false, status: 409, error: 'review_content_not_proposed' }
    const proposal = run.proposedChanges.find(change => change.path === path && change.contentHash === body.contentHash)
    const hunks = Array.isArray(body.hunks) ? body.hunks.slice(0, 500).map(item => ({ id: String(item?.id || '').slice(0, 100), decision: item?.decision === 'accepted' ? 'accepted' : 'rejected' })) : []
    if (proposal.hunks?.length && (hunks.length !== proposal.hunks.length || proposal.hunks.some(hunk => !hunks.some(review => review.id === hunk.id)))) return { ok: false, status: 400, error: 'review_hunks_incomplete' }
    const row = { id: createId('code_review'), runId, workspaceId, projectId: run.projectId, reviewerId: userId, path, contentHash: body.contentHash, decision, hunks, reason: String(body.reason || '').slice(0, 2000), createdAt: nowIso() }
    rows(db, 'codeReviewDecisions').push(row)
    appendCodeEvent(db, { workspaceId, projectId: run.projectId, actorId: userId, type: `code_review_${decision}`, executionRunId: runId, path, metadata: { reviewDecisionId: row.id, contentHash: row.contentHash } })
    return { ok: true, review: row }
  })
}

export function finalizeCodeExecutionRun(userId, workspaceId, runId) {
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const run = rows(db, 'codeExecutionRuns').find(row => row.id === runId && row.workspaceId === workspaceId); if (!run) return { ok: false, status: 404, error: 'execution_run_not_found' }
    const steps = latestSteps(db, runId)
    const missing = REQUIRED_READY_STAGES.filter(stage => steps.find(row => row.stage === stage)?.status !== 'completed')
    if (missing.length) return { ok: false, status: 409, error: 'execution_evidence_incomplete', missing }
    run.status = 'ready_to_apply'; run.updatedAt = nowIso()
    appendCodeEvent(db, { workspaceId, projectId: run.projectId, actorId: userId, type: 'execution_run_ready', executionRunId: runId, metadata: { proposedFiles: run.proposedChanges.length } })
    return { ok: true, run: runView(db, run) }
  })
}

export function applyCodeExecutionRun(userId, workspaceId, runId, body = {}) {
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 100) : []
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const run = rows(db, 'codeExecutionRuns').find(row => row.id === runId && row.workspaceId === workspaceId); if (!run) return { ok: false, status: 404, error: 'execution_run_not_found' }
    if (run.status !== 'ready_to_apply') return { ok: false, status: 409, error: 'execution_run_not_ready' }
    const reviews = latestReviews(db, runId)
    const normalized = changes.map(item => ({ path: safeCodePath(item?.path), content: typeof item?.content === 'string' ? item.content : null, expectedVersion: Number(item?.expectedVersion || 0) }))
    if (normalized.some(item => !item.path || (item.content !== null && Buffer.byteLength(item.content, 'utf8') > 1_000_000))) return { ok: false, status: 400, error: 'execution_change_invalid' }
    for (const change of normalized) {
      const proposal = run.proposedChanges.find(item => item.path === change.path)
      const review = reviews.find(item => item.path === change.path && item.contentHash === proposal?.contentHash && item.decision === 'accepted')
      if (!proposal || !review) return { ok: false, status: 409, error: 'execution_change_not_approved', path: change.path }
      const current = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === change.path)
      if (Number(current?.version || 0) !== change.expectedVersion) return { ok: false, status: 409, error: 'file_version_conflict', path: change.path }
      const accepted = new Set(review.hunks.filter(hunk => hunk.decision === 'accepted').map(hunk => hunk.id))
      const reviewedContent = proposal.hunks?.length ? applyLineHunks(String(current?.content || ''), proposal.hunks, accepted) : change.content
      if (reviewedContent === null || (change.content !== null && change.content !== reviewedContent)) return { ok: false, status: 409, error: 'execution_reviewed_content_mismatch', path: change.path }
      change.content = reviewedContent
    }
    const applied = []
    for (const change of normalized) {
      let file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === change.path)
      const createdAt = nowIso(); const nextVersion = Number(file?.version || 0) + 1; const contentHash = hash(change.content)
      if (!file) { file = { id: createId('project_file'), workspaceId, projectId: run.projectId, path: change.path, createdAt, createdBy: userId }; rows(db, 'projectFiles').push(file) }
      Object.assign(file, { content: change.content, language: languageForPath(change.path), sizeBytes: Buffer.byteLength(change.content, 'utf8'), contentHash, version: nextVersion, deleted: false, updatedAt: createdAt, updatedBy: userId })
      rows(db, 'projectFileVersions').push({ id: createId('file_version'), fileId: file.id, workspaceId, projectId: run.projectId, path: change.path, version: nextVersion, content: change.content, contentHash, actorId: userId, source: 'agent_reviewed', executionRunId: runId, createdAt })
      appendCodeEvent(db, { workspaceId, projectId: run.projectId, actorId: userId, type: 'execution_change_applied', executionRunId: runId, fileId: file.id, path: change.path, after: { contentHash, version: nextVersion } })
      applied.push({ path: change.path, version: nextVersion, contentHash })
    }
    run.status = 'applied'; run.appliedAt = nowIso(); run.updatedAt = run.appliedAt
    return { ok: true, run: runView(db, run), applied }
  })
}

export function scanCodeChanges(changes) {
  const findings = []
  for (const item of Array.isArray(changes) ? changes.slice(0, 100) : []) {
    const path = safeCodePath(item?.path); const content = typeof item?.content === 'string' ? item.content : ''
    if (!path) { findings.push({ severity: 'critical', rule: 'unsafe_path', path: String(item?.path || '') }); continue }
    const rules = [
      ['critical', 'embedded_private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
      ['critical', 'embedded_secret', /(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*['\"][^'\"]{8,}['\"]/i],
      ['high', 'dynamic_code_execution', /\b(?:eval|Function)\s*\(/],
      ['high', 'unsafe_html', /dangerouslySetInnerHTML\s*=/],
      ['high', 'shell_execution', /\b(?:exec|spawn)\s*\([^\n]*(?:shell\s*:\s*true|\/bin\/sh)/],
    ]
    for (const [severity, rule, pattern] of rules) if (pattern.test(content)) findings.push({ severity, rule, path })
  }
  return { findings, critical: findings.filter(row => row.severity === 'critical').length, high: findings.filter(row => row.severity === 'high').length, passed: findings.every(row => row.severity !== 'critical') }
}

function languageForPath(path) {
  const extension = path.split('.').pop()?.toLowerCase()
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python', yml: 'yaml', yaml: 'yaml', sh: 'shell' })[extension] || 'plaintext'
}
