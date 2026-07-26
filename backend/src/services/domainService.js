import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'

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
  const usageDelta = usage.reduce((sum, row) => sum - Math.abs(Number(row.credits || 0)), 0)
  const balance = Number(account?.creditBalance ?? account?.balance ?? 0) + ledgerDelta + usageDelta
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
  return { workspaces: listOwned(db, 'workspaces', userId) }
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
  const workspace = findOwned(db, 'workspaces', workspaceId, userId)
  if (!workspace) return null
  const analysis = latestByProject(db, workspace.projectId)
  return {
    workspaceId,
    projectId: workspace.projectId || null,
    venture: analysis?.blueprint || analysis || null,
    blueprintAvailable: Boolean(analysis?.blueprint || analysis),
  }
}

export function listWorkspaceCollection(userId, workspaceId, name) {
  const db = readDb()
  const workspace = findOwned(db, 'workspaces', workspaceId, userId)
  if (!workspace) return null
  return collection(db, name).filter(row => row.workspaceId === workspaceId && row.ownerId === userId).sort(byNewest)
}

export function createWorkspaceCollectionItem(userId, workspaceId, name, body, prefix) {
  return updateDb(db => {
    const workspace = findOwned(db, 'workspaces', workspaceId, userId)
    if (!workspace) return null
    return insertOwned(db, name, userId, { ...body, workspaceId }, prefix)
  })
}

export function patchWorkspaceCollectionItem(userId, workspaceId, name, itemId, body) {
  return updateDb(db => {
    const workspace = findOwned(db, 'workspaces', workspaceId, userId)
    if (!workspace) return null
    return patchOwned(db, name, itemId, userId, { ...body, workspaceId })
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

export function genericCreate(userId, name, body, prefix, field = 'ownerId') {
  return updateDb(db => insertOwned(db, name, userId, body, prefix, field))
}

export function genericPatch(userId, name, itemId, body, field = 'ownerId') {
  return updateDb(db => patchOwned(db, name, itemId, userId, body, field))
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
