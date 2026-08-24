import { createId, nowIso, userName } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { computeGsisNarrative, extractRecommendation } from './aiRouterClient.js'
import { appendPlatformEventInDb, appendRelationshipInDb } from './discoveryService.js'
import { organizationOverview } from './organizationIntelligenceService.js'

const OWNER_FIELDS = ['ownerId', 'userId', 'founderId', 'collaboratorId', 'investorId', 'organizationId', 'createdBy']

function isRecordVisible(record, userId) {
  if (!record || typeof record !== 'object') return false
  if (record.visibility === 'public' || record.public === true) return true
  return OWNER_FIELDS.some(field => record[field] === userId)
}

function owned(record, userId, field = 'ownerId') {
  return { ...record, [field]: record[field] || userId }
}

function byNewest(a, b) {
  return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
}

const DAY_MS = 86400000

// --- Organization Intelligence: derived-metric helpers ----------------------
// These compute health signals from REAL persisted fields (updatedAt, gsisScore).
// Nothing here fabricates data — decay is derived purely from record staleness.

function daysSince(iso) {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS))
}

// Decay tier from inactivity: 0 healthy (<7d), 1 warning (7-13d),
// 2 stale (14-29d), 3 dormant (30d+). Tunable thresholds, not invented data.
function decayFactor(project) {
  const d = daysSince(project?.updatedAt)
  if (d >= 30) return 3
  if (d >= 14) return 2
  if (d >= 7) return 1
  return 0
}

// Health band combines the real GSIS score with derived decay.
function healthBand(gsis, decay) {
  const score = Number(gsis || 0)
  if (score < 40 || decay >= 3) return 'red'
  if (score < 70 || decay >= 1) return 'amber'
  return 'green'
}

function cleanObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))
}

function collection(db, name) {
  if (!Array.isArray(db[name])) db[name] = []
  return db[name]
}

function listOwned(db, name, userId, field = 'ownerId') {
  return collection(db, name).filter(row => row[field] === userId).sort(byNewest)
}

function findOwned(db, name, id, userId, field = 'ownerId') {
  return collection(db, name).find(row => row.id === id && row[field] === userId) || null
}

function insertOwned(db, name, userId, body, prefix, field = 'ownerId') {
  const now = nowIso()
  const row = owned({
    id: body.id || createId(prefix),
    ...cleanObject(body),
    createdAt: body.createdAt || now,
    updatedAt: now,
  }, userId, field)
  collection(db, name).push(row)
  return row
}

function patchOwned(db, name, id, userId, body, field = 'ownerId') {
  const rows = collection(db, name)
  const idx = rows.findIndex(row => row.id === id && row[field] === userId)
  if (idx === -1) return null
  rows[idx] = { ...rows[idx], ...cleanObject(body), id: rows[idx].id, [field]: userId, updatedAt: nowIso() }
  return rows[idx]
}

function latestByProject(db, projectId) {
  return collection(db, 'projectAnalyses')
    .filter(row => row.projectId === projectId)
    .sort(byNewest)[0] || null
}

function vestingTimelineForGrant(grant) {
  const years = Number(grant.vestingYears || grant.vestingSchedule?.years || 4)
  const cliffMonths = Number(grant.cliffMonths || grant.vestingSchedule?.cliffMonths || 12)
  const totalMonths = Math.max(1, years * 12)
  const grantDate = grant.grantDate || grant.createdAt || nowIso()
  const base = new Date(grantDate)
  const points = []
  for (let i = 0; i < totalMonths; i += 1) {
    const d = new Date(base)
    d.setMonth(base.getMonth() + i)
    const vestedPercent = i < cliffMonths ? 0 : Math.min(100, Math.round((i / totalMonths) * 100))
    points.push({ monthIso: d.toISOString().slice(0, 7), vestedPercent })
  }
  return { projectId: grant.projectId, projectName: grant.projectName || grant.projectId, points }
}

function equityTotals(holdings) {
  const totalValueUSD = holdings.reduce((sum, h) => sum + Number(h.valueUSD || 0), 0)
  const blendedEquityPercent = holdings.reduce((sum, h) => sum + Number(h.equityPercent || 0), 0)
  const vestedThisQuarterUSD = holdings.reduce(
    (sum, h) => sum + Number(h.valueUSD || 0) * (Number(h.vestedPercent || 0) / 100) * 0.25,
    0,
  )
  const nextVestGrant = holdings
    .filter(h => h.nextVest?.date)
    .sort((a, b) => String(a.nextVest.date).localeCompare(String(b.nextVest.date)))[0]
  return {
    totalValueUSD: Math.round(totalValueUSD * 100) / 100,
    blendedEquityPercent: Math.round(blendedEquityPercent * 10000) / 10000,
    vestedThisQuarterUSD: Math.round(vestedThisQuarterUSD * 100) / 100,
    nextVest: nextVestGrant ? {
      startup: nextVestGrant.projectName || nextVestGrant.projectId,
      date: nextVestGrant.nextVest.date,
      deltaPercent: Number(nextVestGrant.nextVest.deltaPercent || 0),
    } : null,
  }
}

function cashTotals(earnings, payouts) {
  const lifetimeUSD = earnings.reduce((sum, e) => sum + Number(e.earned || 0), 0)
  const pendingUSD = earnings.reduce((sum, e) => sum + Number(e.pending || 0), 0)
  const revenueShareTTMUsd = payouts.slice(0, 12).reduce((sum, p) => sum + Number(p.amount || 0), 0) * 0.1
  return {
    lifetimeUSD: Math.round(lifetimeUSD * 100) / 100,
    pendingUSD: Math.round(pendingUSD * 100) / 100,
    revenueShareTTMUsd: Math.round(revenueShareTTMUsd * 100) / 100,
  }
}

function walletSummaryFor(db, userId) {
  const account = collection(db, 'walletAccounts').find(row => row.userId === userId) || null
  const ledger = collection(db, 'creditLedger').filter(row => row.userId === userId)
  const usage = collection(db, 'usageEvents').filter(row => row.userId === userId)
  const ledgerDelta = ledger.reduce((sum, row) => sum + Number(row.deltaCredits || row.credits || 0), 0)
  // Settled usage already creates a credit-ledger debit. Including usage
  // events again would display and enforce a double charge.
  const balance = Number(account?.creditBalance ?? account?.balance ?? 0) + ledgerDelta
  return {
    account: account || { userId, creditBalance: balance, currency: 'USD' },
    creditBalance: balance,
    lifetimeCreditsUsed: usage.reduce((sum, row) => sum + Math.abs(Number(row.credits || 0)), 0),
    pendingPayments: collection(db, 'paymentIntents').filter(row => row.userId === userId && row.status === 'pending').length,
  }
}

export function listProjects(userId) {
  const db = readDb()
  return { projects: listOwned(db, 'projects', userId) }
}

export function createProject(userId, body) {
  return updateDb(db => {
    const origin = cleanObject(body.origin)
    const promotedTeam = origin.kind === 'hackathon_promote'
      ? collection(db, 'hackathonTeams').find(team =>
          team.id === origin.teamId &&
          team.hackathonId === origin.hackathonId &&
          team.leaderId === userId
        )
      : null
    if (origin.kind === 'hackathon_promote' && !promotedTeam) {
      return { ok: false, error: 'hackathon_team_not_found' }
    }

    const project = insertOwned(db, 'projects', userId, {
      title: String(body.title || '').trim(),
      tagline: body.tagline || '',
      industry: body.industry || '',
      stage: body.stage || 'idea',
      isPrimary: Boolean(body.isPrimary),
      gsisScore: Number(body.gsisScore || 0),
      hasWorkspace: Boolean(body.hasWorkspace || promotedTeam?.workspaceId),
      origin,
    }, 'project')
    const event = appendPlatformEventInDb(db, {
      userId, actorId: userId, eventType: 'project_created', entityType: 'project', entityId: project.id,
      importance: 'MEDIUM', metadata: { industry: project.industry, skills: project.requiredSkills || project.skills || [] },
    })
    appendRelationshipInDb(db, userId, event)

    if (promotedTeam) {
      promotedTeam.promotedProjectId = project.id
      promotedTeam.projectId = project.id
      promotedTeam.updatedAt = nowIso()
      const binding = collection(db, 'hackathonTeamWorkspaces')
        .filter(row => row.teamId === promotedTeam.id)
        .sort(byNewest)[0]
      if (binding) {
        binding.projectId = project.id
        binding.updatedAt = nowIso()
        const workspace = collection(db, 'workspaces').find(row => row.id === binding.workspaceId && row.ownerId === userId)
        if (workspace) {
          workspace.projectId = project.id
          workspace.updatedAt = nowIso()
        }
      }
    }

    return { ok: true, project }
  })
}

export function updateProject(userId, projectId, body) {
  return updateDb(db => patchOwned(db, 'projects', projectId, userId, body))
}

export function listOrganizationProjects(userId) {
  const db = readDb()
  return { projects: listOwned(db, 'projects', userId, 'organizationId') }
}

export function createOrganizationProject(userId, body) {
  return updateDb(db => ({
    project: insertOwned(db, 'projects', userId, {
      title: String(body.title || '').trim(),
      tagline: body.tagline || '',
      industry: body.industry || '',
      stage: body.stage || 'idea',
      status: body.status || 'planned',
      progress: Number(body.progress || 0),
      teamName: body.teamName || '',
      memberCount: Number(body.memberCount || 0),
      marketReadyScore: Number(body.marketReadyScore || 0),
      aiLevel: body.aiLevel || '',
      hasWorkspace: Boolean(body.hasWorkspace),
    }, 'project', 'organizationId'),
  }))
}

export function updateOrganizationProject(userId, projectId, body) {
  return updateDb(db => patchOwned(db, 'projects', projectId, userId, body, 'organizationId'))
}

// --- Organization Intelligence: Cohort Health -------------------------------

// Build the derived alerts for a single cohort row from real fields.
function cohortRowAlerts(row) {
  const alerts = []
  if (row.daysInactive >= 14) {
    alerts.push({
      projectId: row.id,
      severity: row.daysInactive >= 30 ? 'high' : 'medium',
      type: 'inactivity',
      message: `${row.title} has been inactive ${row.daysInactive} days.`,
    })
  }
  if (row.gsisScore > 0 && row.gsisScore < 40) {
    alerts.push({
      projectId: row.id,
      severity: 'high',
      type: 'low_gsis',
      message: `${row.title} has a low GSIS score (${row.gsisScore}).`,
    })
  }
  return alerts
}

/**
 * Aggregate cohort health across an organization's real projects.
 * Every value is a persisted field or derived deterministically from one
 * (decay/band/daysInactive from updatedAt + gsisScore). No fabricated data.
 */
export function organizationCohortHealth(userId, { stage, riskLevel } = {}) {
  const db = readDb()
  const projects = listOwned(db, 'projects', userId, 'organizationId')

  let cohort = projects.map(p => {
    const gsisScore = Number(p.gsisScore || 0)
    const decay = decayFactor(p)
    return {
      id: p.id,
      title: p.title || 'Untitled project',
      industry: p.industry || '',
      stage: p.stage || 'idea',
      gsisScore,
      progress: Number(p.progress || 0),
      marketReadyScore: Number(p.marketReadyScore || 0),
      mrr: Number(p.mrr || 0),
      memberCount: Number(p.memberCount || 0),
      daysInactive: daysSince(p.updatedAt),
      decay,
      band: healthBand(gsisScore, decay),
      updatedAt: p.updatedAt || null,
    }
  })

  const stages = [...new Set(cohort.map(r => r.stage))].sort()

  if (stage) cohort = cohort.filter(r => r.stage === stage)
  if (riskLevel) cohort = cohort.filter(r => r.band === riskLevel)
  cohort.sort((a, b) => b.gsisScore - a.gsisScore)

  const alerts = cohort.flatMap(cohortRowAlerts)
  const summary = {
    total: cohort.length,
    green: cohort.filter(r => r.band === 'green').length,
    amber: cohort.filter(r => r.band === 'amber').length,
    red: cohort.filter(r => r.band === 'red').length,
    avgGsis: cohort.length
      ? Math.round(cohort.reduce((s, r) => s + r.gsisScore, 0) / cohort.length)
      : 0,
  }

  return { cohort, alerts, summary, stages }
}

// Deterministic, rule-based intervention keyed off the weakest real signal.
// Used as the honest fallback when ai-router is unavailable.
function ruleBasedIntervention(row) {
  if (row.daysInactive >= 30) return 'Dormant for a month — schedule a re-engagement check-in.'
  if (row.gsisScore > 0 && row.gsisScore < 40) return 'Low GSIS — recommend a pivot or validation workshop.'
  if (row.daysInactive >= 14) return 'Going quiet — send a check-in reminder and confirm milestones.'
  if (row.marketReadyScore < 50) return 'Market readiness is low — assign a go-to-market mentor.'
  if (row.progress < 40) return 'Execution is behind — review milestones and unblock the team.'
  return 'Monitor — no urgent intervention required.'
}

/**
 * Intervention recommendations for at-risk cohort startups.
 * Enriches with ai-router narrative when reachable; otherwise falls back to
 * deterministic rule-based text and flags aiAvailable:false. Never fabricates.
 */
export async function organizationInterventions(userId, token) {
  const { cohort } = organizationCohortHealth(userId)
  const atRisk = cohort.filter(r => r.band !== 'green').slice(0, 10)

  let aiUsed = false
  const recommendations = []
  for (const row of atRisk) {
    let recommendation = null
    let source = 'rule'
    const payload = await computeGsisNarrative(token, {
      gsis: row.gsisScore,
      market_readiness: row.marketReadyScore,
      progress: row.progress,
      days_inactive: row.daysInactive,
    })
    const aiText = extractRecommendation(payload)
    if (aiText) {
      recommendation = aiText
      source = 'ai'
      aiUsed = true
    } else {
      recommendation = ruleBasedIntervention(row)
    }
    recommendations.push({
      projectId: row.id,
      title: row.title,
      band: row.band,
      recommendation,
      source,
    })
  }

  return { recommendations, aiAvailable: aiUsed }
}

// --- Organization Intelligence: Impact Reporting ----------------------------

function groupCount(rows, key) {
  const map = new Map()
  for (const row of rows) {
    const k = String(row[key] || 'unspecified')
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}

const LAUNCHED_STAGES = ['launched', 'growth', 'scaling', 'scale', 'series-a', 'seriesa']

/**
 * Aggregate portfolio impact from an org's real projects. Every metric is a
 * count/sum of persisted fields — nothing fabricated. Metrics with no backing
 * field (users acquired, milestones) are intentionally omitted, not invented.
 */
export function organizationImpact(userId, { template = 'quarterly' } = {}) {
  const db = readDb()
  const projects = listOwned(db, 'projects', userId, 'organizationId')

  const metrics = {
    startups: projects.length,
    productsLaunched: projects.filter(p => LAUNCHED_STAGES.includes(String(p.stage || '').toLowerCase())).length,
    totalMrr: Math.round(projects.reduce((s, p) => s + Number(p.mrr || 0), 0)),
    jobs: projects.reduce((s, p) => s + Number(p.memberCount || 0), 0),
    avgProgress: projects.length
      ? Math.round(projects.reduce((s, p) => s + Number(p.progress || 0), 0) / projects.length)
      : 0,
    avgMarketReady: projects.length
      ? Math.round(projects.reduce((s, p) => s + Number(p.marketReadyScore || 0), 0) / projects.length)
      : 0,
  }

  const charts = {
    stageProgression: groupCount(projects, 'stage'),
    industryBreakdown: groupCount(projects, 'industry'),
    revenueByStartup: projects
      .filter(p => Number(p.mrr || 0) > 0)
      .map(p => ({ name: p.title || 'Untitled', mrr: Number(p.mrr) }))
      .sort((a, b) => b.mrr - a.mrr),
  }

  return { template, metrics, charts, generatedAt: nowIso() }
}

// KPI targets are user-set data, so they are persisted (org-scoped), not derived.
export function organizationKpiTargets(userId) {
  const db = readDb()
  return { targets: listOwned(db, 'orgKpiTargets', userId, 'organizationId') }
}

export function saveOrganizationKpiTarget(userId, body) {
  return updateDb(db => {
    const metric = String(body.metric || '').trim()
    if (!metric) return { ok: false, error: 'metric_required' }
    const target = Number(body.target || 0)
    const existing = collection(db, 'orgKpiTargets').find(
      row => row.organizationId === userId && row.metric === metric,
    )
    if (existing) {
      existing.target = target
      existing.label = body.label || existing.label || metric
      existing.updatedAt = nowIso()
      return { ok: true, target: existing }
    }
    return {
      ok: true,
      target: insertOwned(db, 'orgKpiTargets', userId, {
        metric, target, label: body.label || metric,
      }, 'kpi', 'organizationId'),
    }
  })
}

// --- Organization Intelligence: Demo Day Pipeline ---------------------------

/**
 * Investor-readiness pipeline for an org's projects. Readiness + checklist are
 * derived from real fields; publish state is read from real dealFlowSnapshots.
 */
export function demoDayPipeline(userId, { threshold = 70 } = {}) {
  const db = readDb()
  const th = Number(threshold) || 70
  const projects = listOwned(db, 'projects', userId, 'organizationId')
  const snapshots = collection(db, 'dealFlowSnapshots')

  const pipeline = projects.map(p => {
    const gsisScore = Number(p.gsisScore || 0)
    const published = Boolean(
      snapshots.find(s => s.projectId === p.id && (s.organizationId === userId || s.ownerId === userId)),
    )
    const checklist = [
      { key: 'gsis', label: `GSIS ≥ ${th}`, met: gsisScore >= th },
      { key: 'marketReady', label: 'Market-ready ≥ 60', met: Number(p.marketReadyScore || 0) >= 60 },
      { key: 'traction', label: 'Has MRR', met: Number(p.mrr || 0) > 0 },
      { key: 'progress', label: 'Progress ≥ 50%', met: Number(p.progress || 0) >= 50 },
      { key: 'workspace', label: 'Workspace provisioned', met: Boolean(p.hasWorkspace) },
    ]
    return {
      id: p.id, title: p.title || 'Untitled', industry: p.industry || '', stage: p.stage || 'idea',
      gsisScore, mrr: Number(p.mrr || 0), investorReady: gsisScore >= th, published,
      checklist, readyPct: Math.round((checklist.filter(c => c.met).length / checklist.length) * 100),
    }
  }).sort((a, b) => b.gsisScore - a.gsisScore)

  return { threshold: th, pipeline }
}

// Org-scoped publish. The existing publishProject is ownerId-scoped and cannot
// publish organizationId-owned projects, so this is a dedicated org path.
export function publishOrganizationProject(userId, body) {
  return updateDb(db => {
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return { ok: false, error: 'projectId_required' }
    const project = findOwned(db, 'projects', projectId, userId, 'organizationId')
    if (!project) return { ok: false, error: 'project_not_found' }
    const existing = collection(db, 'dealFlowSnapshots').find(
      row => row.projectId === projectId && row.organizationId === userId,
    )
    if (existing) return { ok: true, snapshotId: existing.id, alreadyPublished: true }
    const snapshot = insertOwned(db, 'dealFlowSnapshots', userId, {
      projectId,
      startupName: project.title,
      name: project.title,
      sector: project.industry || '',
      industry: project.industry || '',
      gsisScore: Number(project.gsisScore || 0),
      rankScore: Number(project.gsisScore || 0),
      readinessScore: Number(project.marketReadyScore || 0),
      mrr: Number(project.mrr || 0),
      visibility: 'public',
      publishedByOrg: true,
    }, 'snapshot', 'organizationId')
    project.visibility = 'public'
    project.publishedAt = nowIso()
    project.updatedAt = nowIso()
    return { ok: true, snapshotId: snapshot.id }
  })
}

// Investor matchmaking over real investor profiles (role 'investor').
export function investorMatches(userId, projectId) {
  const db = readDb()
  const project = findOwned(db, 'projects', projectId, userId, 'organizationId')
  if (!project) return { projectId, matches: [] }
  const investors = collection(db, 'profiles').filter(p => {
    const role = String(p.role || '').toLowerCase()
    const roles = Array.isArray(p.roles) ? p.roles.map(r => String(r).toLowerCase()) : []
    return role === 'investor' || roles.includes('investor')
  })
  const matches = investors.map(inv => {
    const industries = Array.isArray(inv.industries) ? inv.industries : []
    let score = 0
    const reasons = []
    if (industries.map(String).includes(project.industry)) { score += 50; reasons.push('Sector match') }
    if (String(inv.stagePreference || inv.stage || '') === project.stage) { score += 30; reasons.push('Stage match') }
    if (Number(inv.checkSize || 0) > 0) { score += 20; reasons.push('Active check size') }
    return {
      investorId: inv.id,
      name: inv.name || [inv.firstName, inv.lastName].filter(Boolean).join(' ') || 'Investor',
      score, reasons,
    }
  }).filter(m => m.score > 0).sort((a, b) => b.score - a.score)
  return { projectId, matches }
}

export function organizationDemoDayEvents(userId) {
  const db = readDb()
  return { events: listOwned(db, 'orgDemoDayEvents', userId, 'organizationId') }
}

export function createOrganizationDemoDayEvent(userId, body) {
  return updateDb(db => {
    const title = String(body.title || '').trim()
    if (!title) return { ok: false, error: 'title_required' }
    return {
      ok: true,
      event: insertOwned(db, 'orgDemoDayEvents', userId, {
        title,
        date: body.date || '',
        format: body.format || 'in-person',
        slots: Number(body.slots || 0),
        projectIds: Array.isArray(body.projectIds) ? body.projectIds : [],
      }, 'demoday', 'organizationId'),
    }
  })
}

// Post-event analytics from real watchlist rows against this org's snapshots.
export function organizationDemoDayAnalytics(userId) {
  const db = readDb()
  const snapshots = collection(db, 'dealFlowSnapshots').filter(s => s.organizationId === userId)
  const watchlists = collection(db, 'investorWatchlists')
  const projectIds = new Set(snapshots.map(s => s.projectId))
  const watched = watchlists.filter(w => projectIds.has(w.projectId))
  const byProject = snapshots.map(s => ({
    projectId: s.projectId,
    startupName: s.startupName || s.name || 'Untitled',
    watchers: watchlists.filter(w => w.projectId === s.projectId).length,
  })).sort((a, b) => b.watchers - a.watchers)
  return {
    publishedCount: snapshots.length,
    totalWatchlisted: watched.length,
    byProject,
  }
}


function profileDisplayName(profile, fallback = 'TechIT member') {
  if (!profile) return fallback
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
  return fullName || profile.name || profile.username || profile.email || fallback
}

function profileRole(profile, fallback = 'member') {
  if (!profile) return fallback
  if (Array.isArray(profile.roles) && profile.roles.length > 0) return String(profile.roles[0])
  return String(profile.role || fallback)
}

export function listEndorsements(userId) {
  const db = readDb()
  const endorsements = collection(db, 'endorsements')
    .filter(row => row.subjectId === userId)
    .sort(byNewest)
    .map(row => {
      const authorProfile = collection(db, 'profiles').find(profile => profile.id === row.authorId)
      return {
        ...row,
        authorName: profileDisplayName(authorProfile, row.authorName),
        authorRole: profileRole(authorProfile, row.authorRole),
      }
    })
  return { endorsements }
}

export function createEndorsement(userId, body) {
  return updateDb(db => {
    const subjectId = String(body.subjectUserId || '').trim()
    const quote = String(body.quote || '').trim()
    if (!subjectId) return { ok: false, error: 'subject_user_required' }
    if (!quote) return { ok: false, error: 'quote_required' }
    if (subjectId === userId) return { ok: false, error: 'self_endorsement_not_allowed' }

    const subjectExists =
      collection(db, 'users').some(user => user.id === subjectId) ||
      collection(db, 'profiles').some(profile => profile.id === subjectId)
    if (!subjectExists) return { ok: false, error: 'subject_user_not_found' }

    const authorProfile = collection(db, 'profiles').find(profile => profile.id === userId)
    const projectId = String(body.projectId || '').trim()
    const project = projectId
      ? collection(db, 'projects').find(row =>
          row.id === projectId &&
          (row.ownerId === userId || row.ownerId === subjectId || isRecordVisible(row, userId))
        )
      : null
    if (projectId && !project) return { ok: false, error: 'project_not_found' }
    const endorsement = insertOwned(db, 'endorsements', userId, {
      subjectId,
      authorName: profileDisplayName(authorProfile),
      authorRole: profileRole(authorProfile),
      quote,
      projectId: project?.id || null,
      projectName: project?.title || '',
    }, 'endorsement', 'authorId')
    return { ok: true, endorsement }
  })
}

export function listWorkspaces(userId) {
  const db = readDb()
  const memberships = collection(db, 'workspaceMembers').filter(row => row.userId === userId && row.status === 'active')
  const membershipByWorkspace = new Map(memberships.map(row => [row.workspaceId, row]))
  const workspaces = collection(db, 'workspaces')
    .filter(row => row.ownerId === userId || membershipByWorkspace.has(row.id))
    .sort(byNewest)
    .map(workspace => ({
      ...workspace,
      isOwner: workspace.ownerId === userId,
      accessLevel: workspace.ownerId === userId ? 'owner' : membershipByWorkspace.get(workspace.id)?.accessLevel || 'viewer',
    }))
  return { workspaces }
}

function workspaceAccess(db, workspaceId, userId) {
  const workspace = collection(db, 'workspaces').find(row => row.id === workspaceId)
  if (!workspace) return null
  if (workspace.ownerId === userId) return { workspace, isOwner: true, accessLevel: 'owner' }
  const membership = collection(db, 'workspaceMembers').find(row =>
    row.workspaceId === workspaceId && row.userId === userId && row.status === 'active'
  )
  if (!membership) return null
  return { workspace, membership, isOwner: false, accessLevel: membership.accessLevel || 'viewer' }
}

function workspaceCanWrite(access, collectionName) {
  if (access?.isOwner) return true
  return access?.accessLevel === 'contributor' && ['workspaceTasks', 'workspaceReports'].includes(collectionName)
}

function publicWorkspaceInvitation(db, invitation) {
  const workspace = collection(db, 'workspaces').find(row => row.id === invitation.workspaceId)
  const inviter = collection(db, 'profiles').find(row => row.id === invitation.invitedBy)
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    workspaceName: workspace?.name || 'Workspace',
    projectId: workspace?.projectId || invitation.projectId || null,
    collaboratorId: invitation.collaboratorId,
    inviterName: userName(inviter, 'Workspace owner'),
    requestedRole: invitation.requestedRole,
    scope: invitation.scope,
    requiredSkills: invitation.requiredSkills,
    compensationMode: invitation.compensationMode,
    equityProposal: invitation.equityProposal,
    cashReward: invitation.cashReward,
    accessLevel: invitation.accessLevel,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  }
}

export function createWorkspaceInvitation(userId, workspaceId, body) {
  return updateDb(db => {
    const workspace = collection(db, 'workspaces').find(row => row.id === workspaceId && row.ownerId === userId)
    if (!workspace) return { ok: false, error: 'workspace_not_found' }
    const collaboratorId = collaborationText(body.collaboratorId, 100)
    if (!collaboratorId || collaboratorId === userId) return { ok: false, error: 'collaborator_invalid' }
    const collaborator = collection(db, 'profiles').find(row => row.id === collaboratorId && profileHasRole(row, 'collaborator'))
    if (!collaborator) return { ok: false, error: 'collaborator_not_found' }
    const existingMember = collection(db, 'workspaceMembers').find(row =>
      row.workspaceId === workspaceId && row.userId === collaboratorId && row.status === 'active'
    )
    if (existingMember) return { ok: false, error: 'already_member' }

    const requestedRole = collaborationText(body.requestedRole, 80)
    const scope = collaborationText(body.scope, 1000)
    const requiredSkills = collaborationList(body.requiredSkills, 12, 60)
    const accessLevel = body.accessLevel === 'viewer' ? 'viewer' : 'contributor'
    const compensationMode = ['equity-heavy', 'equity-cash', 'cash-only'].includes(body.compensationMode)
      ? body.compensationMode
      : 'equity-heavy'
    const equityProposal = compensationMode === 'cash-only' ? 0 : collaborationNumber(body.equityProposal, 0, 30)
    const cashReward = compensationMode === 'equity-heavy' ? 0 : collaborationNumber(body.cashReward, 0, 1_000_000)
    if (!requestedRole || !scope) return { ok: false, error: 'role_and_scope_required' }
    if (compensationMode !== 'cash-only' && equityProposal <= 0) return { ok: false, error: 'ownership_proposal_required' }
    if (compensationMode !== 'equity-heavy' && cashReward <= 0) return { ok: false, error: 'cash_support_required' }

    const now = nowIso()
    const expiresAt = new Date(Date.now() + 14 * DAY_MS).toISOString()
    const pending = collection(db, 'workspaceInvitations').find(row =>
      row.workspaceId === workspaceId && row.collaboratorId === collaboratorId && row.status === 'pending'
    )
    const invitation = pending || insertOwned(db, 'workspaceInvitations', userId, {
      workspaceId,
      projectId: workspace.projectId || null,
      collaboratorId,
      status: 'pending',
    }, 'workspace_invite', 'invitedBy')
    Object.assign(invitation, {
      requestedRole,
      scope,
      requiredSkills,
      compensationMode,
      equityProposal,
      cashReward,
      accessLevel,
      expiresAt,
      updatedAt: now,
    })

    const inviter = collection(db, 'profiles').find(row => row.id === userId)
    const notification = collection(db, 'notifications').find(row =>
      row.userId === collaboratorId && row.type === 'collab' && row.metadata?.workspaceInvitationId === invitation.id
    )
    const content = `invited you to join ${workspace.name} as ${requestedRole} with ${equityProposal}% proposed ownership`
    const notificationData = {
      userId: collaboratorId,
      actorId: userId,
      type: 'collab',
      read: false,
      content,
      author: userName(inviter),
      linkTo: `/workspace-invitations/${invitation.id}`,
      metadata: { workspaceInvitationId: invitation.id, workspaceId },
      createdAt: notification?.createdAt || now,
    }
    if (notification) Object.assign(notification, notificationData)
    else collection(db, 'notifications').push({ id: createId('notif'), ...notificationData })
    return { ok: true, invitation: publicWorkspaceInvitation(db, invitation) }
  })
}

export function getWorkspaceInvitation(userId, invitationId) {
  const db = readDb()
  const invitation = collection(db, 'workspaceInvitations').find(row =>
    row.id === invitationId && row.collaboratorId === userId
  )
  if (!invitation) return null
  const expired = invitation.status === 'pending' && new Date(invitation.expiresAt).getTime() <= Date.now()
  return publicWorkspaceInvitation(db, expired ? { ...invitation, status: 'expired' } : invitation)
}

export function acceptWorkspaceInvitation(userId, invitationId) {
  return updateDb(db => {
    const invitation = collection(db, 'workspaceInvitations').find(row =>
      row.id === invitationId && row.collaboratorId === userId
    )
    if (!invitation) return { ok: false, error: 'invitation_not_found' }
    const existing = collection(db, 'workspaceMembers').find(row =>
      row.workspaceId === invitation.workspaceId && row.userId === userId && row.status === 'active'
    )
    if (invitation.status === 'accepted' && existing) {
      return { ok: true, invitation: publicWorkspaceInvitation(db, invitation), membership: existing }
    }
    if (invitation.status !== 'pending') return { ok: false, error: `invitation_${invitation.status}` }
    if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
      invitation.status = 'expired'
      invitation.updatedAt = nowIso()
      return { ok: false, error: 'invitation_expired' }
    }
    const workspace = collection(db, 'workspaces').find(row => row.id === invitation.workspaceId)
    if (!workspace) return { ok: false, error: 'workspace_not_found' }
    const membership = existing || insertOwned(db, 'workspaceMembers', workspace.ownerId, {
      workspaceId: workspace.id,
      projectId: workspace.projectId || null,
      userId,
      accessLevel: invitation.accessLevel,
      role: invitation.requestedRole,
      status: 'active',
      invitedBy: invitation.invitedBy,
      invitationId: invitation.id,
      joinedAt: nowIso(),
    }, 'workspace_member', 'workspaceOwnerId')
    invitation.status = 'accepted'
    invitation.acceptedAt = nowIso()
    invitation.updatedAt = invitation.acceptedAt
    collection(db, 'notifications').push({
      id: createId('notif'),
      userId: workspace.ownerId,
      actorId: userId,
      type: 'collab',
      read: false,
      content: `accepted the invitation to join ${workspace.name}`,
      linkTo: `/workspaces/copilot?ws=${encodeURIComponent(workspace.id)}&project=${encodeURIComponent(workspace.projectId || '')}`,
      createdAt: nowIso(),
    })
    return { ok: true, invitation: publicWorkspaceInvitation(db, invitation), membership }
  })
}

export function declineWorkspaceInvitation(userId, invitationId) {
  return updateDb(db => {
    const invitation = collection(db, 'workspaceInvitations').find(row =>
      row.id === invitationId && row.collaboratorId === userId && row.status === 'pending'
    )
    if (!invitation) return { ok: false, error: 'invitation_not_found' }
    invitation.status = 'declined'
    invitation.declinedAt = nowIso()
    invitation.updatedAt = invitation.declinedAt
    const workspace = collection(db, 'workspaces').find(row => row.id === invitation.workspaceId)
    collection(db, 'notifications').push({
      id: createId('notif'),
      userId: invitation.invitedBy,
      actorId: userId,
      type: 'collab',
      read: false,
      content: `declined the invitation to join ${workspace?.name || 'your workspace'}`,
      linkTo: '/feed/profile/' + userId,
      createdAt: nowIso(),
    })
    return { ok: true, invitation: publicWorkspaceInvitation(db, invitation) }
  })
}

export function listWorkspaceMembers(userId, workspaceId) {
  const db = readDb()
  const access = workspaceAccess(db, workspaceId, userId)
  if (!access) return null
  const ownerProfile = collection(db, 'profiles').find(row => row.id === access.workspace.ownerId)
  const members = collection(db, 'workspaceMembers')
    .filter(row => row.workspaceId === workspaceId && row.status === 'active')
    .map(member => {
      const profile = collection(db, 'profiles').find(row => row.id === member.userId)
      return { ...member, name: userName(profile), avatarUrl: profile?.avatarUrl || '' }
    })
  return {
    members: [{
      id: `workspace_owner_${access.workspace.ownerId}`,
      workspaceId,
      userId: access.workspace.ownerId,
      name: userName(ownerProfile),
      accessLevel: 'owner',
      role: 'Workspace owner',
      status: 'active',
    }, ...members],
  }
}

export function removeWorkspaceMember(userId, workspaceId, memberId) {
  return updateDb(db => {
    const workspace = collection(db, 'workspaces').find(row => row.id === workspaceId && row.ownerId === userId)
    if (!workspace) return { ok: false, error: 'workspace_not_found' }
    const member = collection(db, 'workspaceMembers').find(row =>
      row.id === memberId && row.workspaceId === workspaceId && row.status === 'active'
    )
    if (!member) return { ok: false, error: 'member_not_found' }
    member.status = 'removed'
    member.removedAt = nowIso()
    member.updatedAt = member.removedAt
    collection(db, 'notifications').push({
      id: createId('notif'),
      userId: member.userId,
      actorId: userId,
      type: 'collab',
      read: false,
      content: `removed your access to ${workspace.name}`,
      linkTo: '/workspaces',
      createdAt: nowIso(),
    })
    return { ok: true, member }
  })
}

export function provisionWorkspace(userId, body) {
  return updateDb(db => {
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return { ok: false, error: 'projectId_required' }
    const existing = collection(db, 'workspaces').find(row => row.ownerId === userId && row.projectId === projectId)
    if (existing) return { ok: true, workspace: existing }
    const analysis = latestByProject(db, projectId)
    const workspace = insertOwned(db, 'workspaces', userId, {
      projectId,
      name: body.name || analysis?.ventureName || analysis?.venture_name || 'Venture Workspace',
      status: 'active',
      seededFromAnalysis: Boolean(analysis),
      analysisId: analysis?.id,
    }, 'workspace')
    return { ok: true, workspace }
  })
}

export function workspaceContext(userId, workspaceId) {
  const db = readDb()
  const access = workspaceAccess(db, workspaceId, userId)
  if (!access) return null
  const analysis = latestByProject(db, access.workspace.projectId)
  return {
    workspaceId,
    projectId: access.workspace.projectId || null,
    venture: analysis?.blueprint || analysis || null,
    blueprintAvailable: Boolean(analysis?.blueprint || analysis),
    isOwner: access.isOwner,
    accessLevel: access.accessLevel,
  }
}

export function listWorkspaceCollection(userId, workspaceId, name) {
  const db = readDb()
  const access = workspaceAccess(db, workspaceId, userId)
  if (!access) return null
  if (!access.isOwner && ['workspaceAgents', 'workspaceConnectors'].includes(name)) return []
  return collection(db, name).filter(row => row.workspaceId === workspaceId).sort(byNewest)
}

export function createWorkspaceCollectionItem(userId, workspaceId, name, body, prefix) {
  return updateDb(db => {
    const access = workspaceAccess(db, workspaceId, userId)
    if (!access || !workspaceCanWrite(access, name)) return null
    return insertOwned(db, name, userId, { ...body, workspaceId, createdBy: userId }, prefix)
  })
}

export function patchWorkspaceCollectionItem(userId, workspaceId, name, itemId, body) {
  return updateDb(db => {
    const access = workspaceAccess(db, workspaceId, userId)
    if (!access || !workspaceCanWrite(access, name)) return null
    const rows = collection(db, name)
    const idx = rows.findIndex(row => row.id === itemId && row.workspaceId === workspaceId)
    if (idx === -1) return null
    rows[idx] = {
      ...rows[idx],
      ...cleanObject(body),
      id: rows[idx].id,
      workspaceId,
      ownerId: rows[idx].ownerId,
      updatedAt: nowIso(),
    }
    return rows[idx]
  })
}

export function collaboratorEquity(userId) {
  const db = readDb()
  const holdings = listOwned(db, 'equityGrants', userId, 'collaboratorId')
  return { holdings, totals: equityTotals(holdings), vestingTimeline: holdings.map(vestingTimelineForGrant) }
}

export function recordDilution(userId, body) {
  return updateDb(db => {
    const holding = collection(db, 'equityGrants').find(row => row.collaboratorId === userId && row.projectId === body.projectId)
    const equity = Number(holding?.equityPercent || 0)
    const vestedPct = Number(holding?.vestedPercent || 0)
    const newShares = Number(body.newSharesPercent || 0)
    const consent = Boolean(body.consentGiven)
    const vestedEquity = equity * (vestedPct / 100)
    const unvestedEquity = equity - vestedEquity
    const diluted = consent ? equity * (newShares / 100) : unvestedEquity * (newShares / 100)
    const event = insertOwned(db, 'dilutionEvents', userId, {
      projectId: body.projectId,
      newSharesPercent: newShares,
      consentGiven: consent,
      protectedApplied: !consent,
      equityBefore: equity,
      equityAfter: Math.max(0, equity - diluted),
      shieldedEquity: vestedEquity,
    }, 'dilution', 'collaboratorId')
    return event
  })
}

export function collaboratorEarnings(userId) {
  const db = readDb()
  const earnings = listOwned(db, 'collaboratorEarnings', userId, 'collaboratorId')
  const payouts = listOwned(db, 'payouts', userId, 'collaboratorId')
  return { cashEarnings: earnings, payouts, totals: cashTotals(earnings, payouts) }
}

export function requestWithdrawal(userId, body) {
  return updateDb(db => {
    const earnings = listOwned(db, 'collaboratorEarnings', userId, 'collaboratorId')
    const payouts = listOwned(db, 'payouts', userId, 'collaboratorId')
    const totals = cashTotals(earnings, payouts)
    const amount = Number(body.amount || 0)
    if (amount <= 0 || amount > totals.pendingUSD) return { ok: false, error: 'invalid_amount', available: totals.pendingUSD }
    const payout = insertOwned(db, 'payouts', userId, {
      monthIso: body.monthIso || nowIso().slice(0, 7),
      amount,
      status: 'processing',
      destination: body.destination || null,
      idemKey: body.idemKey,
    }, 'payout', 'collaboratorId')
    return { ok: true, payout, destination: payout.destination, newPendingUSD: Math.round((totals.pendingUSD - amount) * 100) / 100 }
  })
}

export function organizationDashboard(userId) {
  const intelligence = organizationOverview(userId)
  if (intelligence?.ok) {
    return {
      dashboard: null,
      metrics: {
        activePrograms: intelligence.metrics.activePrograms,
        hackathons: intelligence.metrics.activePrograms,
        members: intelligence.metrics.members,
        opportunities: intelligence.metrics.opportunities,
        activeCohorts: intelligence.metrics.activeCohorts,
        startups: intelligence.metrics.startups,
        mentors: intelligence.metrics.mentors,
      },
      activity: [],
      charts: {},
      intelligence,
    }
  }
  const db = readDb()
  const dashboard = collection(db, 'organizationDashboards').find(row => row.ownerId === userId) || null
  const hackathons = collection(db, 'hackathons').filter(row => row.ownerId === userId)
  return {
    dashboard,
    metrics: dashboard?.metrics || { activePrograms: 0, hackathons: hackathons.length, members: 0, opportunities: 0 },
    activity: dashboard?.activity || [],
    charts: dashboard?.charts || {},
  }
}

export function investorDealFlow(userId) {
  const db = readDb()
  const watchlist = collection(db, 'investorWatchlists').filter(row => row.investorId === userId).map(row => row.projectId)
  const snapshots = collection(db, 'dealFlowSnapshots').filter(row => row.investorId === userId || row.visibility === 'public')
  const projects = collection(db, 'projects')
  const ranking = snapshots.map(snapshot => {
    const project = projects.find(row => row.id === snapshot.projectId) || {}
    return { ...snapshot, project, watchlisted: watchlist.includes(snapshot.projectId) }
  }).sort((a, b) => Number(b.rankScore || b.eviI || b.gsisScore || 0) - Number(a.rankScore || a.eviI || a.gsisScore || 0))
  return { ranking, watchlistProjectIds: watchlist }
}

export function investorCollection(userId, name, field = 'investorId') {
  const db = readDb()
  return listOwned(db, name, userId, field)
}

export function createInvestorCollection(userId, name, body, prefix, field = 'investorId') {
  return updateDb(db => insertOwned(db, name, userId, body, prefix, field))
}

export function listWatchlist(userId) {
  const db = readDb()
  return { watchlist: listOwned(db, 'investorWatchlists', userId, 'investorId') }
}

export function addWatchlist(userId, body) {
  return updateDb(db => {
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return { ok: false, error: 'projectId_required' }
    const existing = collection(db, 'investorWatchlists').find(row => row.investorId === userId && row.projectId === projectId)
    if (existing) return { ok: true, watchlistItem: existing }
    return { ok: true, watchlistItem: insertOwned(db, 'investorWatchlists', userId, { projectId, notes: body.notes || '' }, 'watch', 'investorId') }
  })
}

export function removeWatchlist(userId, projectId) {
  return updateDb(db => {
    const before = collection(db, 'investorWatchlists').length
    db.investorWatchlists = collection(db, 'investorWatchlists').filter(row => !(row.investorId === userId && row.projectId === projectId))
    return { ok: db.investorWatchlists.length < before }
  })
}

export function listWatchlistPreferences(userId) {
  const db = readDb()
  const row = collection(db, 'investorWatchlistPreferences').find(item => item.investorId === userId)
  return { preferences: { velocity: row?.velocity !== false, risk: row?.risk !== false, milestone: row?.milestone === true, trust: row?.trust === true, dealStatus: row?.dealStatus === true } }
}

export function updateWatchlistPreferences(userId, body = {}) {
  return updateDb(db => {
    const rows = collection(db, 'investorWatchlistPreferences')
    const row = rows.find(item => item.investorId === userId) || { id: createId('watch_pref'), investorId: userId, createdAt: nowIso() }
    for (const key of ['velocity', 'risk', 'milestone', 'trust', 'dealStatus']) if (body[key] !== undefined) row[key] = Boolean(body[key])
    row.updatedAt = nowIso()
    if (!rows.includes(row)) rows.push(row)
    return { preferences: { velocity: row.velocity !== false, risk: row.risk !== false, milestone: row.milestone === true, trust: row.trust === true, dealStatus: row.dealStatus === true } }
  })
}

export function listIntakes(userId) {
  const db = readDb()
  return { intakes: listOwned(db, 'ventureIntakes', userId) }
}

export function createIntake(userId, body) {
  return updateDb(db => ({ intake: insertOwned(db, 'ventureIntakes', userId, {
    status: body.status || 'draft',
    submission: body.submission || body,
    structuredProfile: body.structuredProfile || null,
  }, 'intake') }))
}

export function getIntake(userId, intakeId) {
  const db = readDb()
  return findOwned(db, 'ventureIntakes', intakeId, userId)
}

export function promoteIntake(userId, intakeId, body = {}) {
  return updateDb(db => {
    const intake = findOwned(db, 'ventureIntakes', intakeId, userId)
    if (!intake) return null
    const project = insertOwned(db, 'projects', userId, {
      title: body.title || intake.structuredProfile?.name || intake.submission?.startup_name || 'Untitled venture',
      tagline: body.tagline || intake.structuredProfile?.tagline || '',
      industry: body.industry || intake.structuredProfile?.industry || '',
      stage: body.stage || 'idea',
      origin: { kind: 'venture_intake', intakeId },
    }, 'project')
    intake.promotedProjectId = project.id
    intake.updatedAt = nowIso()
    return { ok: true, project, intake }
  })
}

export function publishProject(userId, body) {
  return updateDb(db => {
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return { ok: false, error: 'projectId_required' }
    const project = findOwned(db, 'projects', projectId, userId)
    if (!project) return { ok: false, error: 'project_not_found' }
    const existing = collection(db, 'dealFlowSnapshots').find(
      row => row.projectId === projectId && row.ownerId === userId
    )
    if (existing) return { ok: true, snapshotId: existing.id, alreadyPublished: true }
    const analysis = latestByProject(db, projectId)
    const blueprint = analysis?.blueprint || {}
    const snapshot = insertOwned(db, 'dealFlowSnapshots', userId, {
      projectId,
      startupName: project.title,
      name: project.title,
      sector: project.industry || '',
      industry: project.industry || '',
      region: project.region || project.location || '',
      visibility: 'public',
      gsisScore: Number(blueprint.gsis_score || project.gsisScore || 0),
      eviI: Number(blueprint.evi_i_score || project.eviI || 0),
      rankScore: Number(blueprint.rank_score || blueprint.gsis_score || project.gsisScore || 0),
      readinessScore: Number(blueprint.market_readiness_score || project.marketReadinessScore || 0),
      investmentScore: Number(blueprint.investment_score || project.investmentScore || 0),
      unicornScore: Number(blueprint.unicorn_potential_score || project.unicornPotentialScore || 0),
      executionVelocity: Number(blueprint.evi_i || project.eviScore || 0),
      founderReliability: Number(project.founderReliabilityScore || 0),
      mrr: Number(project.mrr || 0),
      riskLevel: project.riskLevel || 'unknown',
    }, 'snapshot')
    project.visibility = 'public'
    project.publishedAt = nowIso()
    project.updatedAt = nowIso()
    return { ok: true, snapshotId: snapshot.id }
  })
}

export function listAnalyses(userId) {
  const db = readDb()
  return { analyses: listOwned(db, 'ventureAnalyses', userId) }
}

export function createAnalysis(userId, body) {
  return updateDb(db => {
    const analysis = insertOwned(db, 'ventureAnalyses', userId, body, 'analysis')
    if (body.projectId) {
      collection(db, 'projectAnalyses').push({
        id: analysis.id,
        ownerId: userId,
        projectId: body.projectId,
        module: body.module || 'manual',
        blueprint: body.blueprint || body.output || {},
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      })
    }
    return { analysis }
  })
}

export function getAnalysis(userId, analysisId) {
  const db = readDb()
  return findOwned(db, 'ventureAnalyses', analysisId, userId)
}

function hackathonWithCounts(db, hackathon) {
  const teams = collection(db, 'hackathonTeams').filter(row => row.hackathonId === hackathon.id)
  const members = collection(db, 'hackathonMembers').filter(row => row.hackathonId === hackathon.id)
  return {
    ...hackathon,
    registrants: teams.length + members.length,
    teamsFormed: teams.length,
    stillSolo: teams.filter(row => row.isSolo).length,
  }
}

export function listHackathons(userId, { ownedOnly = false } = {}) {
  const db = readDb()
  return {
    hackathons: collection(db, 'hackathons')
      .filter(row => ownedOnly ? row.ownerId === userId : isRecordVisible(row, userId))
      .sort(byNewest)
      .map(row => hackathonWithCounts(db, row)),
  }
}

export function createHackathon(userId, body) {
  return updateDb(db => ({ hackathon: insertOwned(db, 'hackathons', userId, {
    name: body.name || body.title || 'Untitled hackathon',
    title: body.title || body.name || 'Untitled hackathon',
    theme: body.theme || '',
    status: body.status || 'draft',
    visibility: body.visibility || 'private',
    organizer: cleanObject(body.organizer),
    organizerName: body.organizerName || '',
    poster: body.poster || '',
    summary: body.summary || body.description || '',
    applyDeadline: body.applyDeadline || '',
    publishedAt: body.publishedAt || nowIso(),
    tags: Array.isArray(body.tags) ? body.tags : [],
    featured: Boolean(body.featured),
    startDate: body.startDate || '',
    endDate: body.endDate || '',
    durationHours: Number(body.durationHours || 0),
    prizePool: body.prizePool || '',
    partners: Array.isArray(body.partners) ? body.partners : [],
    eligibility: body.eligibility || '',
    prizes: Array.isArray(body.prizes) ? body.prizes.map(cleanObject) : [],
    judgingDimensions: Array.isArray(body.judgingDimensions) ? body.judgingDimensions : [],
    mentorPool: Number(body.mentorPool || 0),
    hackathonStatus: body.hackathonStatus || body.status || 'upcoming',
  }, 'hack') }))
}

export function getHackathon(userId, hackathonId) {
  const db = readDb()
  const hackathon = collection(db, 'hackathons').find(row => row.id === hackathonId && isRecordVisible(row, userId))
  return hackathon ? hackathonWithCounts(db, hackathon) : null
}

export function registerHackathon(userId, hackathonId, body) {
  return updateDb(db => {
    const hackathon = collection(db, 'hackathons').find(row => row.id === hackathonId && isRecordVisible(row, userId))
    if (!hackathon) return null
    const existing = collection(db, 'hackathonTeams').find(row => row.hackathonId === hackathonId && row.leaderId === userId)
    if (existing) return { ok: true, team: existing, registration: hackathonRegistration(db, existing, userId) }
    const team = insertOwned(db, 'hackathonTeams', userId, {
      hackathonId,
      name: body.name || body.teamName || 'Untitled team',
      isSolo: !Array.isArray(body.members) || body.members.length <= 1,
      status: 'registered',
      teamSize: Math.max(1, Number(body.teamSize || 1)),
      inviteToken: String(body.inviteToken || ''),
      openRoles: Array.isArray(body.openRoles) ? body.openRoles : [],
      rosterClosed: false,
    }, 'team', 'leaderId')
    for (const member of Array.isArray(body.members) ? body.members : []) {
      collection(db, 'hackathonMembers').push({
        id: createId('member'),
        hackathonId,
        teamId: team.id,
        userId: member.userId || member.collaboratorId || null,
        name: member.name || '',
        role: member.role || '',
        createdAt: nowIso(),
      })
    }
    return { ok: true, team, registration: hackathonRegistration(db, team, userId) }
  })
}

function hackathonRegistration(db, team, userId) {
  const members = collection(db, 'hackathonMembers').filter(row => row.teamId === team.id)
  const currentMember = members.find(row => row.userId === userId)
  const brief = collection(db, 'hackathonBriefs').filter(row => row.teamId === team.id).sort(byNewest)[0] || null
  const score = collection(db, 'hackathonScores').filter(row => row.teamId === team.id).sort(byNewest)[0] || null
  const checkIns = collection(db, 'hackathonCheckIns').filter(row => row.teamId === team.id).sort(byNewest)
  const final = collection(db, 'hackathonFinalSubmissions').filter(row => row.teamId === team.id).sort(byNewest)[0] || null
  const workspace = collection(db, 'hackathonTeamWorkspaces').filter(row => row.teamId === team.id).sort(byNewest)[0] || null
  const openRoles = Array.isArray(team.openRoles) ? team.openRoles : []
  const stage = final
    ? 'submitted-final'
    : checkIns.length > 0 || workspace
      ? 'building'
      : brief
        ? 'submitted'
        : 'registered'
  const fallbackScore = score ? {
    overall: Number(score.composite || score.platformAvg || 0),
    problemClarity: Number(score.problemClarityScore || 0),
    innovationGap: Number(score.teamMomentumScore || 0),
    initialImpact: Math.min(100, Number(score.demoReadinessHours || 0) * 6),
    critiques: { problemClarity: [], innovationGap: [], initialImpact: [] },
  } : undefined

  return {
    hackathonId: team.hackathonId,
    teamId: team.id,
    teamName: team.name,
    teamSize: Math.max(Number(team.teamSize || 0), members.length + 1 + openRoles.length),
    role: team.leaderId === userId ? 'leader' : currentMember ? 'member' : 'viewer',
    inviteToken: team.leaderId === userId ? team.inviteToken || '' : '',
    registeredAt: team.createdAt,
    members: members.map(member => ({
      collaboratorId: member.userId || member.id,
      name: member.name || '',
      role: member.role || '',
      acceptedAt: member.createdAt,
    })),
    openRoles,
    stage,
    rosterClosed: Boolean(team.rosterClosed),
    brief: brief ? { ...(brief.fields || {}), submittedAt: brief.createdAt } : undefined,
    briefScore: score?.uiScore || fallbackScore,
    checkIns: checkIns.map(checkIn => ({
      id: checkIn.id,
      loggedAt: checkIn.createdAt,
      status: checkIn.status || 'on-track',
      update: checkIn.note || checkIn.update || '',
      ...(checkIn.blocker ? { blocker: checkIn.blocker } : {}),
    })),
    finalSubmission: final?.submission,
    judgeFeedback: final?.judgeFeedback,
    workspaceId: workspace?.workspaceId || team.workspaceId,
    promotedProjectId: team.promotedProjectId,
  }
}

export function listHackathonRegistrations(userId) {
  const db = readDb()
  const memberTeamIds = new Set(
    collection(db, 'hackathonMembers')
      .filter(row => row.userId === userId)
      .map(row => row.teamId)
  )
  const registrations = collection(db, 'hackathonTeams')
    .filter(team => team.leaderId === userId || memberTeamIds.has(team.id))
    .sort(byNewest)
    .map(team => hackathonRegistration(db, team, userId))
  return { registrations }
}

function profileHasRole(profile, role) {
  const roles = [
    profile?.role,
    ...(Array.isArray(profile?.secondaryRoles) ? profile.secondaryRoles : []),
    ...(Array.isArray(profile?.roles) ? profile.roles : []),
  ].map(value => String(value || '').toLowerCase())
  return roles.includes(role)
}

function publicHackathonInvitation(invitation) {
  return {
    id: invitation.id,
    hackathonId: invitation.hackathonId,
    teamId: invitation.teamId,
    collaboratorId: invitation.collaboratorId,
    role: invitation.role,
    status: invitation.status,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  }
}

export function createHackathonInvitation(userId, hackathonId, teamId, body) {
  return updateDb(db => {
    const team = collection(db, 'hackathonTeams').find(row =>
      row.id === teamId && row.hackathonId === hackathonId && row.leaderId === userId
    )
    if (!team) return { ok: false, error: 'team_not_found' }
    if (team.rosterClosed) return { ok: false, error: 'roster_closed' }

    const collaboratorId = String(body.collaboratorId || '').trim()
    const role = String(body.role || '').trim()
    if (!collaboratorId) return { ok: false, error: 'collaborator_required' }
    if (collaboratorId === userId) return { ok: false, error: 'self_invitation_not_allowed' }
    const profile = collection(db, 'profiles').find(row => row.id === collaboratorId)
    if (!profile || !profileHasRole(profile, 'collaborator')) {
      return { ok: false, error: 'collaborator_not_found' }
    }
    const openRoles = Array.isArray(team.openRoles) ? team.openRoles : []
    if (!role || !openRoles.includes(role)) return { ok: false, error: 'role_unavailable' }
    const members = collection(db, 'hackathonMembers').filter(row => row.teamId === teamId)
    if (members.some(member => member.userId === collaboratorId)) {
      return { ok: false, error: 'already_member' }
    }
    if (members.length + 1 >= Number(team.teamSize || 1)) return { ok: false, error: 'team_full' }

    const existing = collection(db, 'hackathonInvitations').find(row =>
      row.teamId === teamId &&
      row.collaboratorId === collaboratorId &&
      row.role === role &&
      row.status === 'pending'
    )
    if (existing) return { ok: true, invitation: publicHackathonInvitation(existing) }

    const inviterProfile = collection(db, 'profiles').find(row => row.id === userId)
    const token = createId('hinvite')
    const invitation = insertOwned(db, 'hackathonInvitations', userId, {
      hackathonId,
      teamId,
      collaboratorId,
      role,
      status: 'pending',
      token,
    }, 'hackinvite', 'inviterId')
    collection(db, 'notifications').push({
      id: createId('notif'),
      userId: collaboratorId,
      actorId: userId,
      type: 'collab',
      read: false,
      content: `invited you to join ${team.name} as ${role}`,
      author: profileDisplayName(inviterProfile),
      linkTo: `/h/${hackathonId}/team/${teamId}?token=${encodeURIComponent(token)}`,
      invitationId: invitation.id,
      createdAt: nowIso(),
    })
    return { ok: true, invitation: publicHackathonInvitation(invitation) }
  })
}

function targetedHackathonInvitation(db, hackathonId, teamId, token, userId) {
  return collection(db, 'hackathonInvitations').find(row =>
    row.hackathonId === hackathonId &&
    row.teamId === teamId &&
    row.token === token &&
    row.collaboratorId === userId &&
    row.status === 'pending'
  ) || null
}

export function getHackathonInvite(userId, hackathonId, teamId, token) {
  const db = readDb()
  const hackathon = collection(db, 'hackathons').find(row => row.id === hackathonId)
  const team = collection(db, 'hackathonTeams').find(row => row.id === teamId && row.hackathonId === hackathonId)
  if (!hackathon || !team) return { ok: false, error: 'invite_not_found' }
  const invitation = targetedHackathonInvitation(db, hackathonId, teamId, token, userId)
  if (!token || (team.inviteToken !== token && !invitation)) {
    return { ok: false, error: 'invite_token_invalid' }
  }
  const leaderProfile = collection(db, 'profiles').find(profile => profile.id === team.leaderId)
  const registration = hackathonRegistration(db, team, userId)
  return {
    ok: true,
    invite: {
      hackathon,
      teamId,
      teamName: team.name,
      teamSize: registration.teamSize,
      memberCount: registration.members.length + 1,
      openRoles: registration.openRoles,
      rosterClosed: registration.rosterClosed,
      isLeader: team.leaderId === userId,
      leaderName: profileDisplayName(leaderProfile, 'Team leader'),
      invitationId: invitation?.id || '',
      invitedRole: invitation?.role || '',
    },
  }
}

export function acceptHackathonInvite(userId, hackathonId, teamId, body) {
  return updateDb(db => {
    const team = collection(db, 'hackathonTeams').find(row => row.id === teamId && row.hackathonId === hackathonId)
    if (!team) return { ok: false, error: 'invite_not_found' }
    const token = String(body.token || '')
    const invitation = targetedHackathonInvitation(db, hackathonId, teamId, token, userId)
    if (!token || (team.inviteToken !== token && !invitation)) {
      return { ok: false, error: 'invite_token_invalid' }
    }
    if (team.leaderId === userId) return { ok: false, error: 'leader_already_member' }
    if (team.rosterClosed) return { ok: false, error: 'roster_closed' }

    const members = collection(db, 'hackathonMembers').filter(row => row.teamId === teamId)
    const existing = members.find(row => row.userId === userId)
    if (existing) return { ok: true, registration: hackathonRegistration(db, team, userId) }
    if (members.length + 1 >= Number(team.teamSize || 1)) return { ok: false, error: 'team_full' }

    const role = String(invitation?.role || body.role || '').trim()
    const openRoles = Array.isArray(team.openRoles) ? team.openRoles : []
    if (!role || !openRoles.includes(role)) return { ok: false, error: 'role_unavailable' }
    const profile = collection(db, 'profiles').find(row => row.id === userId)
    collection(db, 'hackathonMembers').push({
      id: createId('member'),
      hackathonId,
      teamId,
      userId,
      name: profileDisplayName(profile),
      role,
      createdAt: nowIso(),
    })
    team.openRoles = openRoles.filter(item => item !== role)
    team.isSolo = false
    team.updatedAt = nowIso()
    if (invitation) {
      invitation.status = 'accepted'
      invitation.acceptedAt = nowIso()
      invitation.updatedAt = invitation.acceptedAt
    }
    return { ok: true, registration: hackathonRegistration(db, team, userId) }
  })
}

export function patchHackathonTeam(userId, hackathonId, teamId, body) {
  return updateDb(db => {
    const team = collection(db, 'hackathonTeams').find(row =>
      row.id === teamId && row.hackathonId === hackathonId && row.leaderId === userId
    )
    if (!team) return null
    if (typeof body.rosterClosed === 'boolean') team.rosterClosed = body.rosterClosed
    team.updatedAt = nowIso()
    return { ok: true, registration: hackathonRegistration(db, team, userId) }
  })
}

export function submitHackathonBrief(userId, hackathonId, body) {
  return updateDb(db => {
    const team = collection(db, 'hackathonTeams').find(row => row.hackathonId === hackathonId && row.id === body.teamId && (row.leaderId === userId || row.ownerId === userId))
    if (!team) return null
    const problem = String(body.problem || '')
    const solution = String(body.solution || '')
    const problemClarityScore = Math.min(100, Math.max(0, problem.length * 2))
    const teamMomentumScore = Number(body.teamMomentum || 0)
    const demoReadinessHours = Number(body.demoReadinessHours || 0)
    const platformAvg = Math.round((problemClarityScore + teamMomentumScore + Math.min(100, demoReadinessHours * 6)) / 3)
    const score = insertOwned(db, 'hackathonScores', userId, {
      hackathonId,
      teamId: team.id,
      problemClarityScore,
      teamMomentumScore,
      demoReadinessHours,
      platformAvg,
      composite: Number(body.composite || platformAvg),
      uiScore: cleanObject(body.briefScore),
    }, 'hscore', 'createdBy')
    const brief = insertOwned(db, 'hackathonBriefs', userId, { hackathonId, teamId: team.id, problem, solution, fields: body.fields || {}, scoreId: score.id }, 'brief', 'createdBy')
    team.hasBrief = true
    team.status = team.status === 'registered' ? 'building' : team.status
    team.updatedAt = nowIso()
    return { ok: true, brief, score, registration: hackathonRegistration(db, team, userId) }
  })
}

export function logHackathonCheckIn(userId, hackathonId, body) {
  return updateDb(db => {
    const team = collection(db, 'hackathonTeams').find(row => row.hackathonId === hackathonId && row.id === body.teamId && (row.leaderId === userId || row.ownerId === userId))
    if (!team) return null
    const progressDelta = Number(body.progressDelta || 0)
    const checkIn = insertOwned(db, 'hackathonCheckIns', userId, {
      hackathonId,
      teamId: team.id,
      note: body.note || '',
      status: body.status || 'on-track',
      blocker: body.blocker || '',
      progressDelta,
      activityScore: Math.max(0, Math.min(100, progressDelta * 5)),
    }, 'checkin', 'createdBy')
    team.status = team.status === 'registered' ? 'building' : team.status
    team.updatedAt = nowIso()
    return { ok: true, checkIn, registration: hackathonRegistration(db, team, userId) }
  })
}

export function submitHackathonFinal(userId, hackathonId, teamId, body) {
  return updateDb(db => {
    const team = collection(db, 'hackathonTeams').find(row =>
      row.hackathonId === hackathonId && row.id === teamId && teamOwnedBy(row, userId)
    )
    if (!team) return null
    const existing = collection(db, 'hackathonFinalSubmissions')
      .filter(row => row.teamId === teamId)
      .sort(byNewest)[0]
    if (existing) return { ok: true, finalSubmission: existing, registration: hackathonRegistration(db, team, userId) }
    const finalSubmission = insertOwned(db, 'hackathonFinalSubmissions', userId, {
      hackathonId,
      teamId,
      submission: cleanObject(body.submission),
      judgeFeedback: cleanObject(body.judgeFeedback),
    }, 'final', 'createdBy')
    team.status = 'submitted-final'
    team.updatedAt = nowIso()
    return { ok: true, finalSubmission, registration: hackathonRegistration(db, team, userId) }
  })
}

function teamOwnedBy(team, userId) {
  return team.leaderId === userId || team.ownerId === userId
}

export function hackathonStatus(userId, hackathonId, teamId) {
  const db = readDb()
  const team = collection(db, 'hackathonTeams').find(row => row.hackathonId === hackathonId && row.id === teamId && isRecordVisible({ ...row, ownerId: row.leaderId }, userId))
  if (!team) return null
  const brief = collection(db, 'hackathonBriefs').find(row => row.teamId === teamId)
  const checkIns = collection(db, 'hackathonCheckIns').filter(row => row.teamId === teamId)
  const workspace = collection(db, 'hackathonTeamWorkspaces').find(row => row.teamId === teamId) || null
  return { hackathonId, teamId, team, hasBrief: Boolean(brief), checkIns: checkIns.length, workspace }
}

export function provisionHackathonWorkspace(userId, hackathonId, teamId, body) {
  return updateDb(db => {
    const team = collection(db, 'hackathonTeams').find(row => row.hackathonId === hackathonId && row.id === teamId && row.leaderId === userId)
    if (!team) return null
    const existingBinding = collection(db, 'hackathonTeamWorkspaces')
      .filter(row => row.teamId === teamId)
      .sort(byNewest)[0]
    if (existingBinding) {
      return {
        ok: true,
        project: collection(db, 'projects').find(row => row.id === existingBinding.projectId) || null,
        workspace: collection(db, 'workspaces').find(row => row.id === existingBinding.workspaceId) || null,
        binding: existingBinding,
        registration: hackathonRegistration(db, team, userId),
      }
    }
    const project = insertOwned(db, 'projects', userId, {
      title: body.projectTitle || team.name,
      stage: 'idea',
      origin: { kind: 'hackathon', hackathonId, teamId },
    }, 'project')
    const workspace = insertOwned(db, 'workspaces', userId, {
      projectId: project.id,
      name: body.name || team.name,
      status: 'active',
      seededFromAnalysis: false,
    }, 'workspace')
    const binding = insertOwned(db, 'hackathonTeamWorkspaces', userId, { hackathonId, teamId, projectId: project.id, workspaceId: workspace.id }, 'teamws', 'ownerId')
    team.hasWorkspace = true
    team.projectId = project.id
    team.workspaceId = workspace.id
    return { ok: true, project, workspace, binding, registration: hackathonRegistration(db, team, userId) }
  })
}

export function reportHackathonTeam(userId, hackathonId, teamId, body) {
  return updateDb(db => {
    const team = collection(db, 'hackathonTeams').find(row => row.hackathonId === hackathonId && row.id === teamId && row.leaderId === userId)
    if (!team) return null
    const report = insertOwned(db, 'hackathonTeamReports', userId, { hackathonId, teamId, ...body }, 'report', 'createdBy')
    return { ok: true, report }
  })
}

export function hackathonAggregates(userId, hackathonId) {
  const db = readDb()
  const hackathon = getHackathon(userId, hackathonId)
  if (!hackathon) return null
  const teams = collection(db, 'hackathonTeams').filter(row => row.hackathonId === hackathonId)
  const members = collection(db, 'hackathonMembers').filter(row => row.hackathonId === hackathonId)
  const briefs = collection(db, 'hackathonBriefs').filter(row => row.hackathonId === hackathonId)
  const checkIns = collection(db, 'hackathonCheckIns').filter(row => row.hackathonId === hackathonId)
  const scores = collection(db, 'hackathonScores').filter(row => row.hackathonId === hackathonId)
  const leaderboard = teams.map(team => {
    const score = scores.filter(row => row.teamId === team.id).sort(byNewest)[0]
    return { teamId: team.id, name: team.name, composite: Number(score?.composite || 0) }
  }).sort((a, b) => b.composite - a.composite)
  const velocity = teams.map(team => {
    const teamCheckIns = checkIns.filter(row => row.teamId === team.id)
    const activity = teamCheckIns.length
      ? teamCheckIns.reduce((sum, row) => sum + Number(row.activityScore || 0), 0) / teamCheckIns.length
      : 0
    return { teamId: team.id, name: team.name, activityScore: Math.round(activity * 10) / 10 }
  })
  const crs = leaderboard.map(row => row.composite / 10)
  return {
    overview: {
      hackathonId,
      status: hackathon.status || 'draft',
      registrants: teams.length + members.length,
      teamsFormed: teams.length,
      stillSolo: teams.filter(row => row.isSolo).length,
      ideaSubmissions: briefs.length,
      totalTeams: teams.length,
      avgBuildVelocity: velocity.length ? Math.round((velocity.reduce((s, v) => s + v.activityScore, 0) / velocity.length) * 10) / 10 : 0,
    },
    velocity,
    leaderboard,
    pipeline: {
      incubationInvites: crs.filter(v => v > 7).length,
      prototypeTrack: crs.filter(v => v >= 4 && v <= 6).length,
      backToLearning: crs.filter(v => v < 4).length,
    },
  }
}

export function walletSummary(userId) {
  const db = readDb()
  return walletSummaryFor(db, userId)
}

export function walletList(userId, name) {
  const db = readDb()
  return listOwned(db, name, userId, 'userId')
}

export function createPaymentIntent(userId, body) {
  return updateDb(db => ({ paymentIntent: insertOwned(db, 'paymentIntents', userId, {
    amount: Number(body.amount || 0),
    currency: body.currency || 'USD',
    credits: Number(body.credits || 0),
    status: 'pending',
    provider: body.provider || null,
    idemKey: body.idemKey,
  }, 'pay', 'userId') }))
}

export function genericList(userId, name) {
  const db = readDb()
  return collection(db, name).filter(row => isRecordVisible(row, userId)).sort(byNewest)
}

function collaborationText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function collaborationNumber(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min
}

function collaborationList(value, maxItems = 12, maxLength = 60) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => collaborationText(item, maxLength)).filter(Boolean))].slice(0, maxItems)
}

export function createCollaborationCall(userId, body) {
  return updateDb(db => {
    const projectId = collaborationText(body.projectId, 100)
    const company = collaborationText(body.company || body.projectName, 120)
    const summary = collaborationText(body.summary, 500)
    const scope = collaborationText(body.scope, 1000)
    const role = collaborationText(body.role || body.requestedRole, 80)
    const skills = collaborationList(body.skills || body.requiredSkills)
    const audienceRoles = collaborationList(body.audienceRoles, 3, 24)
      .filter(audience => ['collaborator', 'founder', 'explorer'].includes(audience))
    const compensationMode = ['equity-heavy', 'equity-cash', 'cash-only'].includes(body.compensationMode)
      ? body.compensationMode
      : 'equity-heavy'
    const equityPercent = compensationMode === 'cash-only'
      ? 0
      : collaborationNumber(body.equityPercent, 0, 30)
    const cashCompMonthly = compensationMode === 'equity-heavy'
      ? 0
      : collaborationNumber(body.cashCompMonthly, 0, 1_000_000)
    const requestedDeadline = new Date(collaborationText(body.applyDeadline, 40))
    const applyDeadline = Number.isFinite(requestedDeadline.getTime()) && requestedDeadline.getTime() > Date.now()
      ? requestedDeadline.toISOString()
      : new Date(Date.now() + 30 * DAY_MS).toISOString()

    if (!projectId || !company || !summary || !scope || !role) return { ok: false, error: 'collaboration_call_fields_required' }
    if (audienceRoles.length === 0) return { ok: false, error: 'audience_required' }
    if (compensationMode !== 'cash-only' && equityPercent <= 0) return { ok: false, error: 'ownership_proposal_required' }
    if ((compensationMode === 'equity-cash' || compensationMode === 'cash-only') && cashCompMonthly <= 0) {
      return { ok: false, error: 'cash_support_required' }
    }

    const existing = collection(db, 'opportunities').find(row =>
      row.ownerId === userId &&
      row.type === 'collaboration' &&
      row.projectId === projectId &&
      row.role === role &&
      row.status === 'open'
    )
    if (existing) return { ok: true, opportunity: existing, created: false }

    const founder = collection(db, 'profiles').find(profile => profile.id === userId)
    const opportunity = insertOwned(db, 'opportunities', userId, {
      type: 'collaboration',
      visibility: 'public',
      status: 'open',
      source: 'incubation_validation',
      projectId,
      title: `${role} for ${company}`.slice(0, 160),
      company,
      organizerName: userName(founder, company),
      summary,
      description: summary,
      scope,
      role,
      skills,
      compensationMode,
      equityPercent,
      cashCompMonthly,
      timeCommitment: collaborationText(body.timeCommitment, 80),
      timeline: collaborationText(body.timeline, 40),
      commitmentStyle: collaborationText(body.commitmentStyle, 24),
      industry: collaborationText(body.industry, 80),
      stage: collaborationText(body.stage, 40),
      tags: collaborationList(body.tags),
      audienceRoles,
      applyDeadline,
      publishedAt: nowIso(),
      poster: '',
    }, 'opp')
    return { ok: true, opportunity, created: true }
  })
}

export function genericCreate(userId, name, body, prefix, field = 'ownerId') {
  return updateDb(db => {
    const row = insertOwned(db, name, userId, body, prefix, field)
    const type = name === 'opportunities' ? 'opportunity' : name === 'ventureIntakes' ? 'idea' : name === 'projects' ? 'project' : name
    const event = appendPlatformEventInDb(db, {
      userId, actorId: userId, eventType: `${type}_created`, entityType: type, entityId: row.id,
      importance: type === 'opportunity' ? 'HIGH' : 'MEDIUM',
      metadata: { industry: row.industry, skills: row.requiredSkills || row.skills || [] },
    })
    appendRelationshipInDb(db, userId, event)
    return row
  })
}

export function genericPatch(userId, name, itemId, body, field = 'ownerId') {
  return updateDb(db => {
    const row = patchOwned(db, name, itemId, userId, body, field)
    if (!row) return null
    const type = name === 'opportunities' ? 'opportunity' : name === 'ventureIntakes' ? 'idea' : name === 'projects' ? 'project' : name
    appendPlatformEventInDb(db, {
      userId, actorId: userId, eventType: `${type}_updated`, entityType: type, entityId: row.id,
      importance: type === 'opportunity' ? 'HIGH' : 'MEDIUM', metadata: { industry: row.industry, skills: row.requiredSkills || row.skills || [] },
    })
    return row
  })
}

export function getNotificationPreferences(userId) {
  const db = readDb()
  return collection(db, 'notificationPreferences').find(row => row.userId === userId) || { userId, preferences: {} }
}

export function updateNotificationPreferences(userId, body) {
  return updateDb(db => {
    const rows = collection(db, 'notificationPreferences')
    const idx = rows.findIndex(row => row.userId === userId)
    const currentPreferences = idx === -1 ? {} : cleanObject(rows[idx].preferences)
    const scope = String(body.scope || '').trim()
    const preferences = scope
      ? { ...currentPreferences, [scope]: cleanObject(body.preferences) }
      : cleanObject(body.preferences || body)
    const next = { userId, preferences, updatedAt: nowIso() }
    if (idx === -1) rows.push({ id: createId('prefs'), createdAt: nowIso(), ...next })
    else rows[idx] = { ...rows[idx], ...next }
    return idx === -1 ? rows[rows.length - 1] : rows[idx]
  })
}

export function listContributions(userId) {
  const db = readDb()
  return { contributions: listOwned(db, 'contributions', userId, 'collaboratorId') }
}

export function getCollaboratorScores(userId) {
  const db = readDb()
  const contributions = listOwned(db, 'contributions', userId, 'collaboratorId')
  const verified = contributions.filter(c => c.verified)

  // CBS = Collaborator Build Score (0-100)
  // Based on: number of projects, milestones shipped, consistency
  const projectCount = new Set(verified.map(c => c.projectId)).size
  const totalMilestones = verified.reduce((sum, c) => sum + Number(c.milestonesShipped || 0), 0)
  const cbs = Math.min(100, Math.round((projectCount * 15) + (totalMilestones * 5)))

  // TSS = Technical Specialisation Score
  // Depth per skill based on verified project contributions
  const tss = {}
  for (const contrib of verified) {
    const techs = Array.isArray(contrib.technologies) ? contrib.technologies : []
    for (const tech of techs) {
      tss[tech] = (tss[tech] || 0) + 10
    }
  }
  // Cap each skill at 100
  for (const key of Object.keys(tss)) {
    tss[key] = Math.min(100, tss[key])
  }

  // CRS = Collaboration Reliability Score (0-100)
  // Ratio of verified completions to all contributions
  const total = contributions.length
  const crs = total === 0 ? 0 : Math.round((verified.length / total) * 100)

  return { scores: { cbs, tss, crs } }
}

export function createContract(userId, body) {
  return updateDb(db => {
    const collaboratorId = String(body.collaboratorId || '').trim()
    if (!collaboratorId) return { ok: false, error: 'collaborator_required' }
    if (collaboratorId === userId) return { ok: false, error: 'self_contract_not_allowed' }

    const collaboratorExists =
      collection(db, 'users').some(user => user.id === collaboratorId) ||
      collection(db, 'profiles').some(profile => profile.id === collaboratorId)
    if (!collaboratorExists) return { ok: false, error: 'collaborator_not_found' }

    const contract = insertOwned(db, 'contracts', userId, {
      collaboratorId,
      collaboratorName: String(body.collaboratorName || '').trim(),
      projectName: String(body.projectName || '').trim(),
      role: String(body.role || '').trim(),
      equityPercent: Number(body.equityPercent || 0),
      weeklyHours: Number(body.weeklyHours || 0),
      skills: Array.isArray(body.skills) ? body.skills : [],
      vestingMonths: Number(body.vestingMonths || 48),
      cliffMonths: Number(body.cliffMonths || 12),
      status: 'draft',
      founderSignedAt: null,
      founderSignature: null,
      collaboratorSignedAt: null,
      collaboratorSignature: null,
    }, 'contract', 'founderId')

    return { ok: true, contract }
  })
}

export function listContracts(userId) {
  const db = readDb()
  const contracts = collection(db, 'contracts').filter(row =>
    row.founderId === userId || row.collaboratorId === userId
  ).sort(byNewest)
  return { contracts }
}

export function getContract(userId, contractId) {
  const db = readDb()
  const contract = collection(db, 'contracts').find(row =>
    row.id === contractId && (row.founderId === userId || row.collaboratorId === userId)
  )
  return contract || null
}

export function signContract(userId, contractId) {
  return updateDb(db => {
    const contract = collection(db, 'contracts').find(row =>
      row.id === contractId && row.collaboratorId === userId
    )
    if (!contract) return null
    if (contract.collaboratorSignedAt) {
      return { ok: false, error: 'already_signed' }
    }

    contract.collaboratorSignedAt = nowIso()
    contract.collaboratorSignature = userId
    contract.updatedAt = nowIso()

    if (contract.founderSignedAt && contract.founderSignature) {
      contract.status = 'active'
    } else {
      contract.status = 'pending-countersign'
    }

    return { ok: true, contract }
  })
}

export function countersignContract(userId, contractId) {
  return updateDb(db => {
    const contract = collection(db, 'contracts').find(row =>
      row.id === contractId && row.founderId === userId
    )
    if (!contract) return null
    if (contract.founderSignedAt) {
      return { ok: false, error: 'already_signed' }
    }

    contract.founderSignedAt = nowIso()
    contract.founderSignature = userId
    contract.updatedAt = nowIso()

    if (contract.collaboratorSignedAt && contract.collaboratorSignature) {
      contract.status = 'active'
    } else {
      contract.status = 'pending-signature'
    }

    return { ok: true, contract }
  })
}

export function applyToOpportunity(userId, opportunityId, body) {
  return updateDb(db => {
    const opportunity = collection(db, 'opportunities').find(row => row.id === opportunityId)
    if (!opportunity) return { ok: false, error: 'opportunity_not_found' }
    if (opportunity.ownerId === userId) return { ok: false, error: 'self_application_not_allowed' }

    const existing = collection(db, 'opportunityApplications').find(row =>
      row.applicantId === userId && row.opportunityId === opportunityId
    )
    if (existing) return { ok: false, error: 'already_applied' }

    const application = insertOwned(db, 'opportunityApplications', userId, {
      opportunityId,
      opportunityTitle: opportunity.title || opportunity.name || '',
      message: String(body.message || '').trim(),
      status: 'pending',
    }, 'application', 'applicantId')

    return { ok: true, application }
  })
}

export function listApplications(userId) {
  const db = readDb()
  const applications = collection(db, 'opportunityApplications')
    .filter(row => row.applicantId === userId)
    .sort(byNewest)
  return { applications }
}
