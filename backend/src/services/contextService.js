import { readDb as readAuthorityDb, writeDb as writeAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'

// State machines by role
const FOUNDER_STATES = ['idea', 'validating', 'building_mvp', 'beta_testing', 'pre_launch', 'launched', 'scaling', 'fundraising']
const COLLABORATOR_STATES = ['browsing_roles', 'applied', 'active_contributor', 'portfolio_building', 'seeking_new_project']
const INVESTOR_STATES = ['onboarding', 'thesis_set', 'actively_monitoring', 'due_diligence', 'portfolio_tracking']
const ORGANISATION_STATES = ['setup', 'cohort_active', 'cohort_closing', 'reporting', 'new_cohort_preparing']

function statesForRole(role) {
  switch (role) {
    case 'founder': return FOUNDER_STATES
    case 'collaborator': return COLLABORATOR_STATES
    case 'investor': return INVESTOR_STATES
    case 'organisation': return ORGANISATION_STATES
    default: return ['exploring']
  }
}

function computeFounderState(db, userId) {
  const projects = (db.projects || []).filter(p => p.ownerId === userId)
  const analyses = (db.projectAnalyses || []).filter(a => a.ownerId === userId)
  const workspaces = (db.workspaces || []).filter(w => w.ownerId === userId)

  if (workspaces.length > 0 && projects.some(p => p.status === 'scaling')) return 'scaling'
  if (projects.some(p => p.status === 'launched')) return 'launched'
  if (workspaces.length > 0) return 'building_mvp'
  if (analyses.length > 0) return 'validating'
  return 'idea'
}

function computeCollaboratorState(db, userId) {
  const applications = (db.opportunityApplications || []).filter(a => a.applicantId === userId)
  const contributions = (db.contributions || []).filter(c => c.collaboratorId === userId)
  const equity = (db.equityGrants || []).filter(e => e.collaboratorId === userId)

  if (contributions.length >= 3 && equity.length > 0) return 'portfolio_building'
  if (contributions.length > 0) return 'active_contributor'
  if (applications.length > 0) return 'applied'
  return 'browsing_roles'
}

function computeInvestorState(db, userId) {
  const watchlist = (db.investorWatchlists || []).filter(w => w.ownerId === userId)
  const dealRooms = (db.dealRooms || []).filter(d => d.investorId === userId)

  if (dealRooms.length > 0) return 'due_diligence'
  if (watchlist.length > 0) return 'actively_monitoring'
  return 'onboarding'
}

function computeOrganisationState(db, userId) {
  const hackathons = (db.hackathons || []).filter(h => h.ownerId === userId)
  if (hackathons.some(h => h.status === 'active')) return 'cohort_active'
  if (hackathons.length > 0) return 'reporting'
  return 'setup'
}

export function computeUserState(userId, role) {
  const db = readAuthorityDb()
  let currentState = 'exploring'

  switch (role) {
    case 'founder': currentState = computeFounderState(db, userId); break
    case 'collaborator': currentState = computeCollaboratorState(db, userId); break
    case 'investor': currentState = computeInvestorState(db, userId); break
    case 'organisation': currentState = computeOrganisationState(db, userId); break
  }

  // Persist state
  const existing = (db.userStateMachine || []).find(s => s.userId === userId)
  if (existing) {
    if (existing.currentState !== currentState) {
      existing.previousState = existing.currentState
      existing.currentState = currentState
      existing.stateEnteredAt = nowIso()
    }
    existing.updatedAt = nowIso()
  } else {
    if (!db.userStateMachine) db.userStateMachine = []
    db.userStateMachine.push({
      id: createId('state'),
      userId,
      role,
      currentState,
      previousState: null,
      stateEnteredAt: nowIso(),
      stuckSignals: [],
      updatedAt: nowIso(),
    })
  }
  writeAuthorityDb(db)

  return { currentState, states: statesForRole(role) }
}

export function getSessionContext(userId, role) {
  const db = readAuthorityDb()

  // 1. Last activity
  const sessionLogs = (db.userSessionLogs || [])
    .filter(s => s.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const lastSession = sessionLogs[0] || null
  const daysSinceActive = lastSession
    ? Math.floor((Date.now() - new Date(lastSession.createdAt).getTime()) / 86400000)
    : null

  // 2. Checkpoints (what they were working on)
  const checkpoints = (db.userContextCheckpoints || [])
    .filter(c => c.userId === userId && (!c.expiresAt || new Date(c.expiresAt) > new Date()))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // 3. State machine
  const stateEntry = (db.userStateMachine || []).find(s => s.userId === userId)

  // 4. Pre-computed suggestions
  const suggestions = (db.userSuggestions || []).find(s => s.userId === userId)

  // 5. What changed (notifications created since last session)
  const lastActiveAt = lastSession?.createdAt || new Date(0).toISOString()
  const newNotifications = (db.notifications || [])
    .filter(n => n.userId === userId && n.createdAt > lastActiveAt && !n.read)

  // 6. Decay factor (founders/orgs)
  const profile = (db.profiles || []).find(p => p.id === userId)
  const decayFactor = profile?.decayFactor ?? profile?.decay_factor ?? 1.0
  const gsisScore = profile?.credibilityScore ?? profile?.gsis ?? 0

  // Log this session
  if (!db.userSessionLogs) db.userSessionLogs = []
  db.userSessionLogs.push({
    id: createId('sess'),
    userId,
    createdAt: nowIso(),
  })
  writeAuthorityDb(db)

  // Build response
  const greeting = buildGreeting(role, profile, daysSinceActive)
  const resume = checkpoints.slice(0, 3).map(c => ({
    type: c.checkpointType,
    description: c.description,
    nextStep: c.nextStep,
    actionUrl: c.actionUrl || null,
    cta: c.cta || 'Continue',
  }))

  return {
    greeting: greeting.text,
    awayMessage: daysSinceActive !== null ? `You have been away ${daysSinceActive} day${daysSinceActive !== 1 ? 's' : ''}.` : null,
    decayStatus: role === 'founder' ? {
      factor: decayFactor,
      level: decayFactor >= 0.95 ? 'healthy' : decayFactor >= 0.85 ? 'warning' : 'critical',
      message: decayFactor < 0.85 ? 'Investors can see inactivity on your profile.' : null,
    } : null,
    currentState: stateEntry?.currentState || 'exploring',
    gsisScore,
    resume,
    doNow: suggestions?.doNow || null,
    newSinceLeft: newNotifications.slice(0, 5).map(n => ({
      type: n.type || 'update',
      description: n.content || '',
      url: n.linkTo || '/feed',
    })),
    weeklyPriority: suggestions?.weeklyPriority || null,
  }
}

function buildGreeting(role, profile, daysSinceActive) {
  const firstName = (profile?.firstName || profile?.name || '').split(' ')[0] || 'there'
  if (daysSinceActive === null || daysSinceActive === 0) {
    return { text: `Welcome back, ${firstName}.` }
  }
  if (daysSinceActive <= 1) {
    return { text: `Good to see you, ${firstName}.` }
  }
  return { text: `Welcome back, ${firstName}.` }
}

export function createCheckpoint(userId, body) {
  const db = readAuthorityDb()
  if (!db.userContextCheckpoints) db.userContextCheckpoints = []

  // Upsert by type + reference
  const existing = db.userContextCheckpoints.find(c =>
    c.userId === userId && c.checkpointType === body.checkpointType && c.referenceId === body.referenceId
  )

  if (existing) {
    existing.description = body.description || existing.description
    existing.nextStep = body.nextStep || existing.nextStep
    existing.actionUrl = body.actionUrl || existing.actionUrl
    existing.cta = body.cta || existing.cta
    existing.updatedAt = nowIso()
  } else {
    db.userContextCheckpoints.push({
      id: createId('ckpt'),
      userId,
      checkpointType: body.checkpointType || 'general',
      referenceId: body.referenceId || createId('ref'),
      description: body.description || '',
      nextStep: body.nextStep || '',
      actionUrl: body.actionUrl || null,
      cta: body.cta || 'Continue',
      expiresAt: body.expiresAt || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
  }
  writeAuthorityDb(db)
  return { ok: true }
}

export function clearCheckpoint(userId, checkpointType, referenceId) {
  const db = readAuthorityDb()
  if (!db.userContextCheckpoints) return { ok: true }
  db.userContextCheckpoints = db.userContextCheckpoints.filter(c =>
    !(c.userId === userId && c.checkpointType === checkpointType && c.referenceId === referenceId)
  )
  writeAuthorityDb(db)
  return { ok: true }
}

export function updateSuggestions(userId, suggestions) {
  const db = readAuthorityDb()
  if (!db.userSuggestions) db.userSuggestions = []
  const existing = db.userSuggestions.find(s => s.userId === userId)
  if (existing) {
    existing.doNow = suggestions.doNow || null
    existing.weeklyPriority = suggestions.weeklyPriority || null
    existing.updatedAt = nowIso()
  } else {
    db.userSuggestions.push({
      id: createId('sugg'),
      userId,
      doNow: suggestions.doNow || null,
      weeklyPriority: suggestions.weeklyPriority || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
  }
  writeAuthorityDb(db)
  return { ok: true }
}
