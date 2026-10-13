import { readAuthorityDb } from '../config/database.js'
import { nowIso } from '../utils/api.js'
import { stageRank } from './lifecycleService.js'

// Platform execution metrics (Phase M).
//
// One aggregate reading of the execution ledger: how many startups have been
// built and how far each got (prototype / MVP / launch), plus milestone totals
// and a per-founder breakdown. Every number is a count of persisted rows —
// nothing is estimated or fabricated — and the same stage ladder the lifecycle
// reconciler writes is the source of truth, so founder, organization and admin
// dashboards all read one shape.

const rows = (db, name) => (Array.isArray(db[name]) ? db[name] : [])

// Cumulative rungs: a project at stage X also satisfies every rung at or below
// X, so "prototypes built" stays a strict superset of "MVPs completed".
export const METRIC_RUNGS = [
  { key: 'startups', minRank: stageRank('idea') },
  { key: 'prototypes', minRank: stageRank('prototype') },
  { key: 'mvpCompleted', minRank: stageRank('mvp') },
  { key: 'productsLaunched', minRank: stageRank('launched') },
  { key: 'growth', minRank: stageRank('growth') },
]

const COMPLETED = new Set(['completed', 'complete', 'done', 'shipped'])

function emptyCounts() {
  return Object.fromEntries(METRIC_RUNGS.map(rung => [rung.key, 0]))
}

/** Count projects (by owner) and completed/ total milestones from persisted rows. */
export function computePlatformMetrics(projects = [], milestones = []) {
  const byFounder = new Map()
  const founderOf = new Map()
  for (const project of projects) {
    const founderId = String(project.ownerId || project.founderId || 'unknown')
    founderOf.set(project.id, founderId)
    const entry = byFounder.get(founderId) || { founderId, projects: [], milestones: 0, completedMilestones: 0 }
    entry.projects.push(project)
    byFounder.set(founderId, entry)
  }

  const totals = { ...emptyCounts(), milestones: 0, completedMilestones: 0 }
  const addProject = (counts, project) => {
    const rank = stageRank(project.stage)
    for (const rung of METRIC_RUNGS) if (rank >= rung.minRank) counts[rung.key] += 1
  }

  for (const project of projects) addProject(totals, project)

  for (const milestone of milestones) {
    const founderId = founderOf.get(String(milestone.projectId || milestone.startupId || ''))
    const completed = COMPLETED.has(String(milestone.status || '').toLowerCase())
    totals.milestones += 1
    if (completed) totals.completedMilestones += 1
    const entry = founderId ? byFounder.get(founderId) : null
    if (entry) {
      entry.milestones += 1
      if (completed) entry.completedMilestones += 1
    }
  }

  const perFounder = [...byFounder.entries()]
    .map(([founderId, entry]) => {
      const counts = { ...emptyCounts(), milestones: entry.milestones, completedMilestones: entry.completedMilestones }
      for (const project of entry.projects) addProject(counts, project)
      return { founderId, ...counts }
    })
    .sort((a, b) => b.startups - a.startups || a.founderId.localeCompare(b.founderId))

  return {
    totals: { ...totals, founders: byFounder.size },
    perFounder,
    generatedAt: nowIso(),
  }
}

export function computePlatformMetricsFromDb(db) {
  return computePlatformMetrics(rows(db, 'projects'), rows(db, 'milestones'))
}

/**
 * Aggregate for one caller. Founders only ever see the platform totals plus
 * their own row; organizations and admins additionally receive the per-founder
 * breakdown (row-level identity: this reads the same authority the org
 * dashboard already uses).
 */
export function platformMetricsFor(user) {
  const db = readAuthorityDb()
  const computed = computePlatformMetricsFromDb(db)
  const role = String(user?.role || '').toLowerCase()
  const canSeeAll = ['admin', 'organization', 'organisation', 'organisation_admin'].includes(role)
  const mine = computed.perFounder.find(entry => entry.founderId === String(user?.id)) || null
  return {
    ok: true,
    scope: canSeeAll ? 'platform' : 'founder',
    totals: computed.totals,
    founder: mine,
    perFounder: canSeeAll ? computed.perFounder : undefined,
    generatedAt: computed.generatedAt,
  }
}
