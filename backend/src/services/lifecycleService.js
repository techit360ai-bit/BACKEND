import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { appendPlatformEventInDb } from './discoveryService.js'

// Evidence-based lifecycle stage derivation (Phase L).
//
// The project `stage` was previously a free-text field set by hand, so nothing
// derived "prototype / MVP / beta / launched" from what the founder had actually
// built. This module reads observable evidence (the append-only workspace code
// events, the chosen build path, validation rounds, verified deployments and
// traction) and derives a canonical stage. It reuses existing stores, never
// scores or invents, and keeps the founder's explicit choice as an override.
export const STAGE_LADDER = ['idea', 'prototype', 'mvp', 'beta', 'launched', 'growth']
export const VALIDATION_BETA_THRESHOLD = 3

// Workspace execution evidence that proves "an artifact exists".
const ARTIFACT_EVENT_TYPES = new Set([
  'file_created',
  'file_updated',
  'bridge_file_synced',
  'execution_change_applied',
  'execution_run_ready',
  'deployment_verified',
])

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }

export function stageRank(value) {
  const index = STAGE_LADDER.indexOf(String(value || '').toLowerCase())
  return index < 0 ? 0 : index
}

/**
 * Pure derivation from a normalized evidence object. Highest satisfied rung wins
 * and every transition is recorded with the signal that justified it.
 */
export function deriveLifecycleStage(evidence = {}) {
  const buildPath = evidence.buildPath === 'mvp' ? 'mvp' : evidence.buildPath === 'prototype' ? 'prototype' : null
  const signals = {
    hasArtifact: Boolean(evidence.hasArtifact),
    hasDocument: Boolean(evidence.hasDocument),
    buildPath,
    mvpShipped: Boolean(evidence.mvpShipped),
    validationRounds: Math.max(0, Number(evidence.validationRounds || 0)),
    verifiedDeployment: Boolean(evidence.verifiedDeployment),
    users: Math.max(0, Number(evidence.users || 0)),
    revenue: Math.max(0, Number(evidence.revenue || 0)),
  }
  const reasons = []
  let stage = 'idea'
  if (signals.hasArtifact || signals.hasDocument || buildPath === 'prototype') {
    stage = 'prototype'
    reasons.push(signals.hasArtifact ? 'first artifact recorded' : 'design/prototype evidence present')
  }
  if (buildPath === 'mvp' || signals.mvpShipped) {
    stage = 'mvp'
    reasons.push(buildPath === 'mvp' ? 'MVP build path selected' : 'MVP shipped milestone recorded')
  }
  if (signals.validationRounds >= VALIDATION_BETA_THRESHOLD) {
    stage = 'beta'
    reasons.push(`${signals.validationRounds} validation rounds completed`)
  }
  if (signals.revenue > 0) {
    stage = 'launched'
    reasons.push('revenue is active')
  } else if (signals.verifiedDeployment && signals.users > 0) {
    stage = 'launched'
    reasons.push('verified deployment with live users')
  }
  if (signals.revenue > 0 && signals.users >= 1000) {
    stage = 'growth'
    reasons.push('revenue with 1000+ users')
  }
  return { stage, rank: stageRank(stage), signals, rationale: reasons.length ? reasons.join('; ') : 'no lifecycle evidence yet' }
}

function workspaceIdsForProject(db, projectId) {
  return rows(db, 'workspaces').filter(row => row.projectId === projectId).map(row => row.id)
}

/** Gather the observable evidence for a project from existing stores. */
export function deriveProjectEvidence(db, project) {
  if (!project) return {}
  const projectId = project.id
  const workspaceIds = new Set(workspaceIdsForProject(db, projectId))
  const inScope = row => row.projectId === projectId || workspaceIds.has(row.workspaceId)

  const hasArtifact = rows(db, 'codeChangeEvents').some(row => inScope(row) && ARTIFACT_EVENT_TYPES.has(String(row.type || '')))
    || rows(db, 'projectFiles').some(row => workspaceIds.has(row.workspaceId) && !row.deleted)
  const hasDocument = rows(db, 'documents').some(row => row.projectId === projectId)
  const buildPaths = rows(db, 'workspaceBuildProfiles')
    .filter(row => workspaceIds.has(row.workspaceId) || row.projectId === projectId)
    .map(row => row.buildPath)
  const buildPath = buildPaths.includes('mvp') ? 'mvp' : buildPaths.includes('prototype') ? 'prototype' : null
  const mvpShipped = [...rows(db, 'mvpEvents'), ...rows(db, 'milestones')].some(row => row.projectId === projectId
    && ['mvp', 'mvp_shipped', 'mvp_ready'].includes(String(row.type || row.kind || row.status || '').toLowerCase()))
  const validationRounds = [...rows(db, 'validationSessions'), ...rows(db, 'customerValidations'), ...rows(db, 'validationRounds')]
    .filter(row => row.projectId === projectId).length
  const verifiedDeployment = rows(db, 'codeDeploymentVerifications').some(row => workspaceIds.has(row.workspaceId) && row.status === 'verified')
    || rows(db, 'codeDeploymentRecords').some(row => workspaceIds.has(row.workspaceId) && row.status === 'verified')

  return {
    hasArtifact,
    hasDocument,
    buildPath,
    mvpShipped,
    validationRounds,
    verifiedDeployment,
    users: Number(project.users || 0),
    revenue: Number(project.revenueMonthly || project.mrr || project.revenue || 0),
  }
}

function appendLifecycleEvidence(db, userId, project, previousStage, nextStage, metadata) {
  const payload = { userId, actorId: userId, eventType: 'project_stage_changed', entityType: 'project', entityId: project.id, importance: 'MEDIUM', metadata }
  appendPlatformEventInDb(db, payload)
  for (const workspaceId of workspaceIdsForProject(db, project.id)) {
    rows(db, 'workspaceLifecycleEvents').push({
      id: createId('workspace_event'),
      workspaceId,
      projectId: project.id,
      actorId: userId,
      previous: { stage: previousStage },
      next: { stage: nextStage },
      metadata: { event: 'project.stage.changed', ...metadata },
      createdAt: nowIso(),
    })
  }
}

/**
 * Reconcile a project's stage with its evidence. Advances monotonically, and
 * never overrides an explicit founder choice (manual override kept).
 */
export function reconcileProjectStage(userId, projectId, options = {}) {
  if (!projectId) return { ok: false, status: 400, error: 'project_id_required' }
  return updateAuthorityDb(db => reconcileProjectStageInDb(db, userId, projectId, options))
}

/**
 * Secondary-path wrapper: lifecycle reconciliation must never break the write
 * that triggered it (e.g. a row-level/Postgres request without an authority
 * context). Failures are logged, not thrown.
 */
export function reconcileStageBestEffort(userId, projectId, options = {}) {
  try {
    return reconcileProjectStage(userId, projectId, options)
  } catch (error) {
    console.error(JSON.stringify({ event: 'lifecycle_reconcile_failed', projectId, error: error.message }))
    return { ok: false, error: 'lifecycle_reconcile_failed' }
  }
}

export function reconcileProjectStageInDb(db, userId, projectId, options = {}) {
  const project = rows(db, 'projects').find(row => row.id === projectId)
  if (!project) return { ok: false, status: 404, error: 'project_not_found' }
  const detection = deriveLifecycleStage(deriveProjectEvidence(db, project))
  const current = String(project.stage || 'idea').toLowerCase()
  if (project.stageSource === 'manual') {
    return { ok: true, changed: false, stage: current, previous: current, source: 'manual', detection, manualKept: true }
  }
  if (detection.rank <= stageRank(current)) {
    return { ok: true, changed: false, stage: current, previous: current, source: 'auto', detection }
  }
  const previous = current
  project.stage = detection.stage
  project.stageSource = 'auto'
  project.stageChangedAt = nowIso()
  project.updatedAt = project.stageChangedAt
  appendLifecycleEvidence(db, userId, project, previous, detection.stage, {
    from: previous,
    to: detection.stage,
    trigger: options.trigger || 'evidence',
    source: 'auto',
    rationale: detection.rationale,
    signals: detection.signals,
  })
  return { ok: true, changed: true, stage: detection.stage, previous, source: 'auto', detection }
}

/** Mark an explicit founder stage change so auto-derivation keeps it. */
export function noteManualStageInDb(db, userId, project, previousStage) {
  const stage = String(project.stage || 'idea').toLowerCase()
  project.stageSource = 'manual'
  project.stageChangedAt = nowIso()
  appendLifecycleEvidence(db, userId, project, previousStage, stage, {
    from: previousStage,
    to: stage,
    trigger: 'manual',
    source: 'manual',
  })
}

export function currentLifecycleStage(projectId) {
  const db = readAuthorityDb()
  const project = rows(db, 'projects').find(row => row.id === projectId)
  if (!project) return null
  return { stage: String(project.stage || 'idea').toLowerCase(), source: project.stageSource || 'auto', detection: deriveLifecycleStage(deriveProjectEvidence(db, project)) }
}
