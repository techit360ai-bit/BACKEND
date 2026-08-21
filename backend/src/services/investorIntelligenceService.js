import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : null
const isoTime = value => { const time = new Date(value || 0).getTime(); return Number.isFinite(time) ? time : 0 }
const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
const latest = (items, field = 'updatedAt') => [...items].sort((a, b) => isoTime(b[field] || b.createdAt) - isoTime(a[field] || a.createdAt))[0] || null
const unique = values => [...new Set(values.filter(Boolean))]

function authorizedProjectIds(db, investorId) {
  const ids = new Set()
  for (const row of rows(db, 'investorWatchlists')) if (row.investorId === investorId || row.ownerId === investorId) ids.add(row.projectId || row.startupId)
  for (const row of rows(db, 'dealFlowSnapshots')) if (row.investorId === investorId) ids.add(row.projectId || row.startupId)
  for (const name of ['investorRelationships', 'investments', 'portfolioInvestments', 'investorPortfolio']) {
    for (const row of rows(db, name)) if ([row.investorId, row.userId, row.ownerId].includes(investorId)) ids.add(row.projectId || row.startupId || row.resourceId)
  }
  for (const name of ['dealRooms', 'dataRooms']) for (const row of rows(db, name)) if (row.investorId === investorId) ids.add(row.projectId || row.startupId)
  return new Set([...ids].filter(Boolean))
}

function milestoneRows(db, projectId, project, snapshot) {
  const persisted = rows(db, 'milestones').filter(row => row.projectId === projectId || row.startupId === projectId)
  const embedded = [...(Array.isArray(project?.milestones) ? project.milestones : []), ...(Array.isArray(snapshot?.milestones) ? snapshot.milestones : [])]
  return [...persisted, ...embedded]
}

function mentorshipRows(db, projectId) {
  const rooms = rows(db, 'mentorshipRooms').filter(row => row.projectId === projectId || row.startupId === projectId)
  const roomIds = new Set(rooms.map(row => row.id))
  const mentees = rows(db, 'mentorshipMentees').filter(row => roomIds.has(row.roomId) && row.status !== 'removed')
  const tasks = rows(db, 'mentorshipTasks').filter(row => roomIds.has(row.roomId) || row.projectId === projectId || row.startupId === projectId)
  const completedTasks = tasks.filter(row => ['completed', 'done'].includes(String(row.status).toLowerCase())).length
  return { rooms, mentees, tasks, completedTasks }
}

function projectActivity(db, projectId, project) {
  const events = [...rows(db, 'projectActivities'), ...rows(db, 'startupActivities'), ...rows(db, 'recommendationEvents')]
    .filter(row => row.projectId === projectId || row.startupId === projectId)
    .sort((a, b) => isoTime(b.createdAt || b.updatedAt) - isoTime(a.createdAt || a.updatedAt))
  return { events, lastMeaningfulAt: events[0]?.createdAt || events[0]?.updatedAt || project?.updatedAt || project?.createdAt || null }
}

function buildStartup(db, investorId, projectId) {
  const project = rows(db, 'projects').find(row => row.id === projectId) || {}
  const snapshot = latest(rows(db, 'dealFlowSnapshots').filter(row => (row.projectId || row.startupId) === projectId && row.investorId === investorId)) || latest(rows(db, 'dealFlowSnapshots').filter(row => (row.projectId || row.startupId) === projectId && row.visibility === 'public')) || {}
  const milestones = milestoneRows(db, projectId, project, snapshot)
  const completedMilestones = milestones.filter(row => ['completed', 'complete', 'done'].includes(String(row.status).toLowerCase())).length
  const overdueMilestones = milestones.filter(row => !['completed', 'complete', 'done'].includes(String(row.status).toLowerCase()) && row.dueDate && isoTime(row.dueDate) < Date.now()).length
  const milestoneProgress = milestones.length ? clamp((completedMilestones / milestones.length) * 100) : asNumber(snapshot.milestoneProgress ?? project.milestoneProgress)
  const mentorship = mentorshipRows(db, projectId)
  const mentorshipCompletion = mentorship.tasks.length ? clamp((mentorship.completedTasks / mentorship.tasks.length) * 100) : null
  const activity = projectActivity(db, projectId, project)
  const daysInactive = activity.lastMeaningfulAt ? Math.max(0, Math.floor((Date.now() - isoTime(activity.lastMeaningfulAt)) / 86400000)) : null
  const execution = asNumber(snapshot.executionVelocity ?? snapshot.eviI ?? snapshot.evi_i ?? project.executionVelocity ?? project.eviScore)
  const readiness = asNumber(snapshot.readinessScore ?? snapshot.marketReadiness ?? project.marketReadinessScore)
  const engagement = mentorship.mentees.length ? clamp((mentorship.mentees.filter(row => row.status === 'active').length / mentorship.mentees.length) * 100) : asNumber(project.founderEngagement)
  const consistency = daysInactive === null ? null : clamp(100 - Math.min(100, daysInactive * 4))
  const dimensions = [execution, milestoneProgress, engagement, consistency].filter(value => value !== null)
  const health = dimensions.length ? clamp(dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length) : null
  const riskLevel = overdueMilestones >= 2 || (daysInactive !== null && daysInactive >= 21) || (execution !== null && execution < 30) ? 'high' : overdueMilestones >= 1 || (daysInactive !== null && daysInactive >= 7) || (execution !== null && execution < 55) ? 'moderate' : dimensions.length ? 'low' : 'unknown'
  const evidence = unique([
    milestones.length ? `${completedMilestones}/${milestones.length} milestones completed` : null,
    overdueMilestones ? `${overdueMilestones} milestones overdue` : null,
    mentorship.rooms.length ? `${mentorship.rooms.length} mentorship room(s)` : null,
    mentorship.tasks.length ? `${mentorship.completedTasks}/${mentorship.tasks.length} mentorship tasks completed` : null,
    activity.lastMeaningfulAt ? `last meaningful activity ${activity.lastMeaningfulAt}` : null,
  ])
  return {
    startupId: projectId,
    name: project.title || snapshot.startupName || snapshot.name || projectId,
    sector: project.industry || snapshot.industry || snapshot.sector || '',
    status: project.status || 'active',
    health,
    executionVelocity: execution,
    milestoneProgress,
    founderEngagement: engagement,
    consistency,
    readiness,
    riskLevel,
    daysInactive,
    mentorship: { rooms: mentorship.rooms.length, activeMentees: mentorship.mentees.filter(row => row.status === 'active').length, tasks: mentorship.tasks.length, completedTasks: mentorship.completedTasks, completion: mentorshipCompletion },
    milestones: { total: milestones.length, completed: completedMilestones, overdue: overdueMilestones },
    lastMeaningfulAt: activity.lastMeaningfulAt,
    evidence,
    deterministic: true,
  }
}

function persistSnapshot(investorId, scope, startups) {
  return updateDb(db => {
    const timestamp = nowIso()
    rows(db, 'investorIntelligenceSnapshots').push({ id: createId('investor_intel'), investorId, scope, startups, createdAt: timestamp })
    rows(db, 'investorIntelligenceAudits').push({ id: createId('investor_intel_audit'), investorId, action: 'intelligence_viewed', scope, startupIds: startups.map(row => row.startupId), createdAt: timestamp })
    return timestamp
  })
}

export function investorIntelligenceOverview(investorId) {
  const db = readDb(); const ids = authorizedProjectIds(db, investorId); const startups = [...ids].map(id => buildStartup(db, investorId, id)).filter(Boolean)
  const overview = { portfolio: { total: startups.length, healthy: startups.filter(row => row.riskLevel === 'low').length, onTrack: startups.filter(row => row.riskLevel === 'moderate').length, highRisk: startups.filter(row => row.riskLevel === 'high').length }, startups, changes: buildChanges(db, investorId, startups), generatedAt: nowIso(), deterministic: true }
  persistSnapshot(investorId, 'overview', startups)
  return overview
}

export function investorStartupIntelligence(investorId, startupId) {
  const db = readDb(); if (!authorizedProjectIds(db, investorId).has(startupId)) return null
  const startup = buildStartup(db, investorId, startupId); persistSnapshot(investorId, `startup:${startupId}`, [startup]); return { startup, deterministic: true }
}

function buildChanges(db, investorId, startups) {
  const previous = latest(rows(db, 'investorIntelligenceSnapshots').filter(row => row.investorId === investorId && row.scope === 'overview'))
  const priorById = new Map((previous?.startups || []).map(row => [row.startupId, row]))
  return startups.flatMap(row => {
    const old = priorById.get(row.startupId); const changes = []
    if (!old) changes.push({ startupId: row.startupId, name: row.name, type: 'newly_authorized', summary: 'New authorized startup intelligence is available.', severity: 'info' })
    if (old && row.riskLevel !== old.riskLevel) changes.push({ startupId: row.startupId, name: row.name, type: 'risk_changed', summary: `Risk changed from ${old.riskLevel} to ${row.riskLevel}.`, severity: row.riskLevel === 'high' ? 'high' : 'medium' })
    if (old && row.milestones.overdue > old.milestones.overdue) changes.push({ startupId: row.startupId, name: row.name, type: 'milestone_overdue', summary: `${row.milestones.overdue - old.milestones.overdue} additional milestone(s) became overdue.`, severity: 'medium' })
    if (old && row.executionVelocity !== null && old.executionVelocity !== null && Math.abs(row.executionVelocity - old.executionVelocity) >= 10) changes.push({ startupId: row.startupId, name: row.name, type: 'execution_changed', summary: `Execution velocity changed ${Math.round(row.executionVelocity - old.executionVelocity)} points.`, severity: row.executionVelocity < old.executionVelocity ? 'medium' : 'info' })
    return changes
  }).slice(0, 50)
}

export function investorRiskSignals(investorId) {
  const overview = investorIntelligenceOverview(investorId)
  return { risks: overview.startups.filter(row => ['moderate', 'high'].includes(row.riskLevel)).map(row => ({ startupId: row.startupId, name: row.name, severity: row.riskLevel, reasons: row.evidence, recommendedAction: row.riskLevel === 'high' ? 'Review the latest authorized progress before the next portfolio discussion.' : 'Monitor the next milestone and progress update.', deterministic: true })) }
}

export function investorDailyBrief(investorId) {
  const overview = investorIntelligenceOverview(investorId)
  const completedMilestones = overview.startups.reduce((sum, row) => sum + row.milestones.completed, 0)
  const overdueMilestones = overview.startups.reduce((sum, row) => sum + row.milestones.overdue, 0)
  const attention = overview.startups.filter(row => ['moderate', 'high'].includes(row.riskLevel)).sort((a, b) => (b.riskLevel === 'high' ? 1 : 0) - (a.riskLevel === 'high' ? 1 : 0)).slice(0, 5)
  return {
    portfolio: overview.portfolio,
    totalStartups: overview.startups.length,
    significantChanges: overview.changes.length,
    milestonesCompleted: completedMilestones,
    milestonesOverdue: overdueMilestones,
    attention: attention.map(row => ({ startupId: row.startupId, name: row.name, riskLevel: row.riskLevel, evidence: row.evidence, recommendedAction: row.riskLevel === 'high' ? 'Review the latest authorized progress before the next portfolio discussion.' : 'Monitor the next milestone and progress update.' })),
    generatedAt: overview.generatedAt,
    deterministic: true,
  }
}

export function investorAdvisoryEvidence(investorId, startupId = null) {
  const db = readDb(); const ids = authorizedProjectIds(db, investorId); const selected = startupId ? (ids.has(startupId) ? [startupId] : []) : [...ids]
  const startups = selected.map(id => buildStartup(db, investorId, id)).filter(Boolean)
  return { scope: startupId ? `startup:${startupId}` : 'portfolio', startups, instructions: 'Explain observed changes and suggest review actions. Do not authorize access, change scores, or make investment decisions.' }
}
