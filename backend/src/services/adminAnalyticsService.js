// Backend-native implementation of the seven analytics contracts formerly
// served by the standalone admin dashboard BFF. Events are projected from
// persisted platform rows on every request; empty collections produce zeroed
// analytics rather than seeded or assumed activity.
import { readAuthorityDb } from '../config/database.js'
import { adminAuthEnabled } from '../repositories/adminAuthRepository.js'
import { adminAnalyticsCollections } from '../repositories/adminAnalyticsRepository.js'
import { listMilestoneProofsForAdmin } from '../repositories/trustRepository.js'
import {
  calculateAiSystemHealthDashboard,
  calculateGeographyAlertsDashboard,
  calculateMissionControl,
  calculateReferralCollaborationDashboard,
  calculateRevenueRetentionDashboard,
  calculateUserDashboard,
} from './adminAnalyticsCalculations.js'

const DAY_MS = 24 * 60 * 60 * 1000
const AI_ROUTER_URL = (process.env.AI_ROUTER_URL || 'http://localhost:8000').replace(/\/$/, '')

const EVENT = {
  registered: 'User Registered',
  emailVerified: 'Email Verified',
  profileCompleted: 'Profile Completed',
  projectCreated: 'Project Created',
  projectJoined: 'Project Joined',
  startupCreated: 'Startup Created',
  startupLaunched: 'Startup Launched',
  connectionAccepted: 'Connection Accepted',
  collaborationCompleted: 'Collaboration Completed',
  referralSent: 'Referral Sent',
  referralAccepted: 'Referral Accepted',
  subscriptionPurchased: 'Subscription Purchased',
  creditPurchased: 'Credit Purchased',
  paymentFailed: 'Payment Failed',
  aiRecommendationGenerated: 'AI Recommendation Generated',
  aiRecommendationClicked: 'AI Recommendation Clicked',
  aiRecommendationSuccess: 'AI Recommendation Success',
  aiChatSession: 'AI Chat Session',
  apiRequest: 'API Request',
  sessionStarted: 'Session Started',
  mentorSession: 'Mentor Session Booked',
  investorMeeting: 'Investor Meeting Booked',
  organizationPartnership: 'Organization Partnership Created',
}

const rows = (db, name) => Array.isArray(db?.[name]) ? db[name] : []
const text = value => typeof value === 'string' ? value.trim() : ''
const number = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function timestamp(...values) {
  for (const value of values) {
    if (!value) continue
    const date = new Date(value)
    if (Number.isFinite(date.getTime())) return date.toISOString()
  }
  return null
}

function identityMaps(db) {
  const identities = new Map()
  for (const user of rows(db, 'users')) {
    if (!user?.id) continue
    identities.set(String(user.id), { ...user, timestamp: timestamp(user.createdAt, user.updatedAt) })
  }
  for (const profile of rows(db, 'profiles')) {
    if (!profile?.id) continue
    const current = identities.get(String(profile.id)) || {}
    identities.set(String(profile.id), {
      ...current,
      ...profile,
      email: profile.email || current.email,
      createdAt: profile.createdAt || current.createdAt,
      updatedAt: profile.updatedAt || current.updatedAt,
    })
  }
  const projects = new Map(rows(db, 'projects').filter(row => row?.id).map(row => [String(row.id), row]))
  return { identities, projects }
}

function identityFor(row, identities) {
  const userId = String(row?.userId || row?.ownerId || row?.actorId || row?.collaboratorId || row?.founderId || '')
  return { userId, profile: identities.get(userId) || null }
}

function countryFor(profile, row = {}) {
  return text(profile?.country || row.country || row.countryCode || 'Unknown') || 'Unknown'
}

function roleFor(profile, row = {}) {
  return text(profile?.role || row.role || 'unknown').toLowerCase() || 'unknown'
}

function event(eventName, userId, at, { profile = null, row = {}, metadata = {} } = {}) {
  const occurredAt = timestamp(at)
  if (!occurredAt || !userId) return null
  return {
    event_id: `${eventName}:${row.id || userId}:${occurredAt}`,
    user_id: String(userId),
    event_name: eventName,
    role: roleFor(profile, row),
    timestamp: occurredAt,
    device: 'server',
    country: countryFor(profile, row),
    metadata: {
      ...(profile?.firstName || profile?.lastName ? { name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') } : {}),
      ...(profile?.email ? { email: profile.email } : {}),
      ...(profile?.university ? { university: profile.university } : {}),
      ...(profile?.state ? { state: profile.state } : {}),
      ...(profile?.orgName ? { organization: profile.orgName } : {}),
      ...metadata,
    },
  }
}

function add(out, value) {
  if (value) out.push(value)
}

function projectionEventType(value) {
  const type = String(value || '').toLowerCase()
  if (type.includes('generated') || type.includes('impression')) return EVENT.aiRecommendationGenerated
  if (type.includes('success') || type.includes('outcome')) return EVENT.aiRecommendationSuccess
  if (type.includes('chat')) return EVENT.aiChatSession
  if (type.includes('click') || type.includes('view') || type.includes('connect') || type.includes('apply') || type.includes('join')) return EVENT.aiRecommendationClicked
  return null
}

function subscriptionAmount(row) {
  return number(
    row.amountMonthlyUsd ?? row.monthlyAmountUsd ?? row.amount_usd ?? row.amountUsd ??
    row.monthlyPriceUsd ?? row.priceUsd ?? row.priceMonthly ?? row.planPriceUsd,
  )
}

function creditAmount(row) {
  return number(row.amountUsd ?? row.paymentAmountUsd ?? row.totalUsd ?? row.priceUsd ?? row.amount)
}

export function analyticsEventsFromDb(db) {
  const { identities } = identityMaps(db)
  const moments = new Map(rows(db, 'techitMoments').filter(row => row?.id).map(row => [String(row.id), row]))
  const events = []

  for (const [userId, profile] of identities.entries()) {
    add(events, event(EVENT.registered, userId, profile.createdAt || profile.updatedAt, { profile, row: profile }))
    if (profile.isVerified === true || profile.emailVerified === true) {
      add(events, event(EVENT.emailVerified, userId, profile.verifiedAt || profile.updatedAt || profile.createdAt, { profile, row: profile }))
    }
    if (profile.isOnboarded === true || profile.profileCompleted === true || profile.onboardingCompletedAt) {
      add(events, event(EVENT.profileCompleted, userId, profile.onboardingCompletedAt || profile.updatedAt || profile.createdAt, { profile, row: profile }))
    }
  }

  for (const row of rows(db, 'userSessionLogs')) {
    const { userId, profile } = identityFor(row, identities)
    add(events, event(EVENT.sessionStarted, userId, row.createdAt || row.updatedAt, {
      profile,
      row,
      metadata: { duration_seconds: number(row.durationSeconds ?? row.duration_seconds) },
    }))
  }

  for (const row of rows(db, 'projects')) {
    const { userId, profile } = identityFor(row, identities)
    const createdAt = row.createdAt || row.updatedAt
    add(events, event(EVENT.projectCreated, userId, createdAt, { profile, row, metadata: { project: row.name || row.title || null } }))
    if (row.type === 'startup' || row.isStartup === true || row.startup === true) {
      add(events, event(EVENT.startupCreated, userId, createdAt, { profile, row, metadata: { project: row.name || row.title || null } }))
    }
    if (['launched', 'launch'].includes(String(row.stage || row.status || '').toLowerCase())) {
      add(events, event(EVENT.startupLaunched, userId, row.launchedAt || row.updatedAt || createdAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'workspaceMembers')) {
    const { userId, profile } = identityFor(row, identities)
    add(events, event(EVENT.projectJoined, userId, row.joinedAt || row.createdAt || row.updatedAt, { profile, row, metadata: { project_id: row.projectId || null } }))
  }

  for (const row of rows(db, 'networkEdges')) {
    const { userId, profile } = identityFor(row, identities)
    if (['connection', 'collaboration', 'accepted'].includes(String(row.type || row.status || '').toLowerCase())) {
      add(events, event(EVENT.connectionAccepted, userId, row.acceptedAt || row.createdAt || row.updatedAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'connectionRequests')) {
    const { userId, profile } = identityFor(row, identities)
    if (['accepted', 'connected'].includes(String(row.status || '').toLowerCase())) {
      add(events, event(EVENT.connectionAccepted, userId, row.acceptedAt || row.updatedAt || row.createdAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'contributions')) {
    const { userId, profile } = identityFor(row, identities)
    if (row.verified === true || ['verified', 'completed', 'complete', 'done', 'shipped'].includes(String(row.status || '').toLowerCase())) {
      add(events, event(EVENT.collaborationCompleted, userId, row.verifiedAt || row.completedAt || row.updatedAt || row.createdAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'milestones')) {
    const { userId, profile } = identityFor(row, identities)
    if (['completed', 'complete', 'done', 'shipped', 'approved'].includes(String(row.status || '').toLowerCase())) {
      add(events, event(EVENT.collaborationCompleted, userId, row.completedAt || row.approvedAt || row.updatedAt || row.createdAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'mentorshipRooms')) {
    const { userId, profile } = identityFor(row, identities)
    if (['published', 'active', 'accepted', 'scheduled'].includes(String(row.status || 'published').toLowerCase())) {
      add(events, event(EVENT.mentorSession, userId, row.scheduledAt || row.createdAt || row.updatedAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'mentorshipApplications')) {
    const { userId, profile } = identityFor(row, identities)
    if (['accepted', 'active', 'completed'].includes(String(row.status || '').toLowerCase())) {
      add(events, event(EVENT.mentorSession, userId, row.acceptedAt || row.updatedAt || row.createdAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'organizationPartners')) {
    const { userId, profile } = identityFor(row, identities)
    add(events, event(EVENT.organizationPartnership, userId, row.createdAt || row.updatedAt, { profile, row }))
  }

  for (const row of rows(db, 'dealRooms')) {
    const { userId, profile } = identityFor(row, identities)
    if (row.meetingAt || row.scheduledAt || ['meeting', 'scheduled', 'meeting_scheduled'].includes(String(row.status || '').toLowerCase())) {
      add(events, event(EVENT.investorMeeting, userId, row.meetingAt || row.scheduledAt || row.createdAt || row.updatedAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'dealStatusEvents')) {
    const { userId, profile } = identityFor(row, identities)
    if (String(row.type || row.status || '').toLowerCase().includes('meeting')) {
      add(events, event(EVENT.investorMeeting, userId, row.createdAt || row.updatedAt, { profile, row }))
    }
  }

  for (const row of rows(db, 'subscriptions')) {
    const { userId, profile } = identityFor(row, identities)
    if (['active', 'trialing', 'grace_period', 'past_due'].includes(String(row.status || 'active').toLowerCase())) {
      add(events, event(EVENT.subscriptionPurchased, userId, row.currentPeriodStart || row.startedAt || row.createdAt || row.updatedAt, {
        profile,
        row,
        metadata: { plan: row.planName || row.planId || row.plan || 'Paid', amount_monthly_usd: subscriptionAmount(row) },
      }))
    }
  }

  for (const row of rows(db, 'creditLedger')) {
    const { userId, profile } = identityFor(row, identities)
    const type = String(row.type || '').toLowerCase()
    if (/(credit.*purchase|purchase.*credit|credits_purchased|subscription_purchase)/.test(type)) {
      add(events, event(EVENT.creditPurchased, userId, row.createdAt || row.updatedAt, {
        profile,
        row,
        metadata: { amount_usd: creditAmount(row), credits: number(row.deltaCredits ?? row.credits) },
      }))
    }
  }

  for (const name of ['paymentIntents', 'invoices']) {
    for (const row of rows(db, name)) {
      const { userId, profile } = identityFor(row, identities)
      const status = String(row.status || '').toLowerCase()
      if (['failed', 'declined', 'error', 'past_due'].includes(status)) {
        add(events, event(EVENT.paymentFailed, userId, row.failedAt || row.updatedAt || row.createdAt, {
          profile,
          row,
          metadata: { amount_usd: creditAmount(row), reason: row.failureReason || row.failureCode || status },
        }))
      }
    }
  }

  for (const row of rows(db, 'recommendationEvents')) {
    const { userId, profile } = identityFor(row, identities)
    const eventName = projectionEventType(row.eventType || row.type)
    if (!eventName) continue
    add(events, event(eventName, userId, row.createdAt || row.updatedAt, {
      profile,
      row,
      metadata: {
        latency_ms: number(row.latencyMs ?? row.metadata?.latencyMs ?? row.metadata?.latency_ms),
        tokens: number(row.tokens ?? row.totalTokens ?? row.metadata?.tokens),
        outcome: row.outcome || row.metadata?.outcome || row.eventType,
        recommendation_id: row.entityId || row.metadata?.recommendationId,
        feature: row.surface,
      },
    }))
  }

  for (const row of rows(db, 'usageEvents')) {
    const { userId, profile } = identityFor(row, identities)
    const status = String(row.status || '').toLowerCase()
    add(events, event(EVENT.apiRequest, userId, row.createdAt || row.updatedAt, {
      profile,
      row,
      metadata: {
        status: status === 'completed' ? 200 : ['failed', 'error'].includes(status) ? 500 : 499,
        duration_ms: number(row.latencyMs),
        db_ms: number(row.dbMs ?? row.metadata?.dbMs ?? row.metadata?.db_ms),
        queue_length: number(row.queueLength),
        service: row.provider || 'backend',
        path: row.taskType || 'usage',
      },
    }))
    if (String(row.taskType || '').toLowerCase().includes('chat')) {
      add(events, event(EVENT.aiChatSession, userId, row.createdAt || row.updatedAt, {
        profile,
        row,
        metadata: { latency_ms: number(row.latencyMs), tokens: number(row.totalTokens), outcome: row.status },
      }))
    }
  }

  for (const row of rows(db, 'techitMomentShares')) {
    const { userId, profile } = identityFor(row, identities)
    add(events, event(EVENT.referralSent, userId, row.createdAt || row.updatedAt, { profile, row, metadata: { channel: row.channel } }))
  }

  for (const row of rows(db, 'techitMomentReferrals')) {
    const moment = moments.get(String(row.momentId || ''))
    const referrerId = row.userId || row.referrerId || moment?.userId || row.signupUserId
    const userId = String(referrerId || '')
    const profile = identities.get(userId) || null
    if (row.signupUserId || row.activatedAt || String(row.status || '').toLowerCase() === 'activated') {
      add(events, event(EVENT.referralAccepted, userId, row.signupAt || row.activatedAt || row.updatedAt || row.createdAt, {
        profile,
        row,
        metadata: { referred_user_id: row.signupUserId || null, source: 'referral' },
      }))
    }
  }

  for (const row of rows(db, 'techitMomentEvents')) {
    const { userId, profile } = identityFor(row, identities)
    if (row.type === 'moment_shared') add(events, event(EVENT.referralSent, userId, row.createdAt || row.updatedAt, { profile, row }))
    if (row.type === 'moment_activated') add(events, event(EVENT.referralAccepted, userId, row.createdAt || row.updatedAt, { profile, row }))
  }

  return events
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

async function sourceStatus() {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(`${AI_ROUTER_URL}/health`, { signal: controller.signal })
    return {
      backend: { ok: true, configured: true, status: 200, latencyMs: 0 },
      aiRouter: { ok: response.ok, configured: true, status: response.status, latencyMs: Date.now() - startedAt },
    }
  } catch (error) {
    return {
      backend: { ok: true, configured: true, status: 200, latencyMs: 0 },
      aiRouter: { ok: false, configured: true, status: 0, latencyMs: Date.now() - startedAt, error: error?.message || String(error) },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function loadCollections() {
  if (adminAuthEnabled()) return adminAnalyticsCollections()
  return readAuthorityDb()
}

function dashboardContext(db, now = new Date()) {
  const events = analyticsEventsFromDb(db)
  return { events, now }
}

export async function missionControlDashboard(now = new Date()) {
  const db = await loadCollections()
  return calculateMissionControl(dashboardContext(db, now).events, await sourceStatus(), now)
}

export async function userAnalyticsDashboard(now = new Date()) {
  const db = await loadCollections()
  return calculateUserDashboard(dashboardContext(db, now).events, now)
}

export async function referralCollaborationDashboard(now = new Date()) {
  const db = await loadCollections()
  return calculateReferralCollaborationDashboard(dashboardContext(db, now).events, now)
}

export async function revenueRetentionDashboard(now = new Date()) {
  const db = await loadCollections()
  return calculateRevenueRetentionDashboard(dashboardContext(db, now).events, now)
}

export async function aiSystemHealthDashboard(now = new Date()) {
  const db = await loadCollections()
  return calculateAiSystemHealthDashboard(dashboardContext(db, now).events, await sourceStatus(), now)
}

export async function geographyAlertsDashboard(now = new Date()) {
  const db = await loadCollections()
  return calculateGeographyAlertsDashboard(dashboardContext(db, now).events, await sourceStatus(), now)
}

function fallbackMilestoneProofs(db) {
  return [
    ...rows(db, 'trustVerificationProofs'),
    ...rows(db, 'trustMilestoneProofs'),
  ].filter(row => String(row.source || row.proofType || '').toLowerCase() === 'milestone')
}

function sameUtcDay(value, now) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    && date.getUTCFullYear() === now.getUTCFullYear()
    && date.getUTCMonth() === now.getUTCMonth()
    && date.getUTCDate() === now.getUTCDate()
}

export async function trustMilestoneReviewsDashboard(now = new Date()) {
  const db = await loadCollections()
  const { identities, projects } = identityMaps(db)
  const remote = adminAuthEnabled() ? await listMilestoneProofsForAdmin() : { available: false, proofs: [] }
  const proofs = remote.proofs.length ? remote.proofs : fallbackMilestoneProofs(db)
  const pending = proofs.filter(row => ['pending', 'submitted', 'awaiting_review'].includes(String(row.status || '').toLowerCase()))
  const reviewed = proofs.filter(row => ['verified', 'approved', 'rejected'].includes(String(row.status || '').toLowerCase()))
  const queue = pending.map(row => {
    const founderId = String(row.userId || row.user_id || '')
    const projectId = String(row.projectId || row.project_id || '')
    const profile = identities.get(founderId)
    const project = projects.get(projectId)
    return {
      id: String(row.id),
      projectId,
      founderName: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.name || '',
      startupName: project?.name || project?.title || '',
      milestone: row.metadata?.milestoneType || row.type || row.method || 'Milestone proof',
      evidenceUrl: '',
      submittedAt: row.createdAt || row.created_at || now.toISOString(),
      status: 'pending',
      riskFlags: Array.isArray(row.metadata?.riskFlags) ? row.metadata.riskFlags : [],
      source: 'live',
    }
  })
  return {
    generatedAt: now.toISOString(),
    pendingCount: queue.length,
    approvedToday: reviewed.filter(row => ['verified', 'approved'].includes(String(row.status || '').toLowerCase()) && sameUtcDay(row.reviewedAt || row.verifiedAt || row.updatedAt, now)).length,
    rejectedToday: reviewed.filter(row => String(row.status || '').toLowerCase() === 'rejected' && sameUtcDay(row.reviewedAt || row.updatedAt, now)).length,
    metadataOnly: true,
    rawUploadsStored: false,
    queue,
  }
}

export const __test = { analyticsEventsFromDb, projectionEventType, sameUtcDay }
