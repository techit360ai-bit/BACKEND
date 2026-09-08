import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { avatarGradient, createId, nowIso, timeAgo, userName } from '../utils/api.js'
import { appendPlatformEventInDb, appendRelationshipInDb, syncRecommendationProfileInDb } from '../services/discoveryService.js'
import { createPrivateUpload, finalizePrivateUpload, privateDownloadUrl } from '../services/evidenceStorageService.js'
import { findIdentityById, listIdentityProfiles, updateIdentityProfile } from '../repositories/identityRepository.js'

const UPDATABLE = new Set([
  'firstName', 'lastName', 'username', 'phone', 'country', 'countryCode',
  'avatarUrl', 'bio', 'secondaryRoles', 'isOnboarded', 'startupStage', 'industries', 'experience',
  'skills', 'weeklyHours', 'riskTolerance', 'investmentFocus', 'ticketSize',
  'orgName', 'orgType', 'website', 'linkedinUrl', 'githubUrl', 'portfolioUrl',
  'timezone', 'certifications', 'title', 'twitterUrl',
  'yearsBuilding', 'founderType', 'oneLiner', 'foundingYear', 'logoEmoji',
  'currentTeamSize', 'openRoles', 'compensationOffered', 'equityRangeMin', 'equityRangeMax',
  'launchStatus', 'users', 'revenueMonthly', 'fundingRaised', 'leadInvestor',
  'nextMilestone', 'whyBuilding', 'winningIn3Years', 'unfairAdvantage', 'ownershipPhilosophy',
  'yearsExperience', 'discipline', 'subSkills', 'techStack', 'earliestStart',
  'commitmentStyle', 'equityPreference', 'minCashFloor', 'vestingComfort',
])

export async function getMe(req, res) {
  const db = readAuthorityDb()
  let profile
  if (process.env.IDENTITY_READ_SOURCE === 'postgres') {
    try { profile = (await findIdentityById(req.user.id))?.profile } catch (error) { if (process.env.IDENTITY_READ_FALLBACK_SQLITE === 'false') throw error }
  }
  profile ||= db.profiles.find(p => p.id === req.user.id)
  if (!profile) return res.status(404).json({ error: 'Profile not found' })
  const response = { ...profile }
  if (profile.avatarObjectKey) response.avatarUrl = privateDownloadUrl(profile.avatarObjectKey, 900)
  return res.json(response)
}

export async function updateMe(req, res) {
  const updates = {}
  for (const [key, value] of Object.entries(req.body)) {
    if (UPDATABLE.has(key)) updates[key] = value
  }

  if (process.env.IDENTITY_WRITE_SOURCE === 'postgres') {
    try {
      const profile = await updateIdentityProfile(req.user.id, updates)
      if (profile) {
        updateAuthorityDb(db => {
          const idx = db.profiles.findIndex(item => item.id === req.user.id)
          if (idx === -1) return
          db.profiles[idx] = { ...db.profiles[idx], ...profile }
          syncRecommendationProfileInDb(db, req.user.id)
        })
        return res.json(profile)
      }
      if (process.env.IDENTITY_WRITE_FALLBACK_SQLITE === 'false') return res.status(404).json({ error: 'Profile not found' })
    } catch (error) {
      console.error(JSON.stringify({ event: 'identity_postgres_profile_write_failed', error: error.message }))
      if (process.env.IDENTITY_WRITE_FALLBACK_SQLITE === 'false') return res.status(503).json({ error: 'identity_write_temporarily_unavailable' })
    }
  }
  const result = updateAuthorityDb(db => {
    const idx = db.profiles.findIndex(p => p.id === req.user.id)
    if (idx === -1) return null
    db.profiles[idx] = { ...db.profiles[idx], ...updates, updatedAt: new Date().toISOString() }
    syncRecommendationProfileInDb(db, req.user.id)
    return db.profiles[idx]
  })
  if (!result) return res.status(404).json({ error: 'Profile not found' })
  return res.json(result)
}

export function avatarUploadUrl(req, res) {
  const contentType = String(req.body?.contentType || '').toLowerCase()
  const sizeBytes = Number(req.body?.sizeBytes || 0)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return res.status(400).json({ error: 'unsupported_avatar_type' })
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) return res.status(400).json({ error: 'invalid_avatar_size' })
  const upload = createPrivateUpload({ namespace: 'profile-avatars', ownerId: req.user.id, objectId: createId('avatar'), contentType, sizeBytes })
  return upload.ok ? res.json({ objectKey: upload.objectKey, uploadUrl: upload.uploadUrl, requiredHeaders: upload.requiredHeaders, expiresIn: 900 }) : res.status(503).json({ error: upload.error || 'avatar_storage_unavailable' })
}

export async function avatarFinalize(req, res) {
  const objectKey = String(req.body?.objectKey || '')
  const contentType = String(req.body?.contentType || '').toLowerCase()
  const sizeBytes = Number(req.body?.sizeBytes || 0)
  if (!objectKey.startsWith(`profile-avatars/${req.user.id}/`)) return res.status(403).json({ error: 'avatar_object_forbidden' })
  const scan = await finalizePrivateUpload({ objectKey, contentType, expectedSizeBytes: sizeBytes })
  if (!scan.ok) return res.status(400).json({ error: scan.error || 'avatar_scan_failed' })
  const profile = updateAuthorityDb(db => {
    const row = db.profiles.find(item => item.id === req.user.id)
    if (!row) return null
    row.avatarObjectKey = objectKey
    row.avatarContentType = contentType
    row.avatarSizeBytes = sizeBytes
    row.avatarUpdatedAt = nowIso()
    row.avatarUrl = privateDownloadUrl(objectKey, 900)
    row.updatedAt = nowIso()
    return row
  })
  return profile ? res.json({ profile, avatarUrl: profile.avatarUrl, scan }) : res.status(404).json({ error: 'Profile not found' })
}

export function avatarRemove(req, res) {
  const profile = updateAuthorityDb(db => {
    const row = db.profiles.find(item => item.id === req.user.id)
    if (!row) return null
    row.avatarObjectKey = null; row.avatarUrl = null; row.avatarContentType = null; row.avatarSizeBytes = 0; row.updatedAt = nowIso()
    return row
  })
  return profile ? res.json({ ok: true, profile }) : res.status(404).json({ error: 'Profile not found' })
}

function publicProfile(profile, db, viewerId) {
  const posts = db.feedPosts.filter(p => p.authorId === profile.id)
  const comments = db.feedComments.filter(c => c.authorId === profile.id)
  const connections = (db.networkEdges || []).filter(edge => edge.sourceId === profile.id || edge.targetId === profile.id).length
  const recentActivity = [
    ...posts.map(p => ({
      id: p.id,
      type: p.kind || 'post',
      title: p.title || p.body.slice(0, 90),
      date: timeAgo(p.createdAt),
    })),
    ...comments.map(c => ({
      id: c.id,
      type: 'answer',
      title: c.body.slice(0, 90),
      date: timeAgo(c.createdAt),
    })),
  ]
    .sort((a, b) => String(b.id).localeCompare(String(a.id)))
    .slice(0, 6)

  return {
    id: profile.id,
    name: userName(profile),
    username: profile.username || null,
    role: profile.orgName ? profile.orgName : profile.role,
    category: profile.industries?.[0] || profile.investmentFocus?.[0] || 'General',
    stage: profile.startupStage || (profile.isOnboarded ? 'Active' : 'Setup'),
    gsis: profile.credibilityScore || 0,
    location: [profile.country, profile.timezone].filter(Boolean).join(' · ') || 'Not specified',
    joinedDate: profile.createdAt,
    email: viewerId === profile.id || profile.isVerified ? profile.email : null,
    bio: profile.bio || '',
    website: profile.website || profile.portfolioUrl || profile.linkedinUrl || profile.githubUrl || '',
    avatar: profile.avatarUrl || avatarGradient(profile.id),
    avatarUrl: profile.avatarUrl || '',
    isVerified: Boolean(profile.isVerified),
    credibilityScore: boundedNumber(profile.credibilityScore, 0, 100),
    credibilityLevel: credibilityLevel(profile.credibilityScore),
    subscriber: activeSubscription(db, profile.id) !== null,
    subscriptionLabel: activeSubscription(db, profile.id) ? 'Subscriber' : null,
    sharedContext: sharedPlatformContext(db, viewerId, profile.id),
    isOwnProfile: viewerId === profile.id,
    stats: {
      decay: null,
      stageProgress: null,
      posts: posts.length,
      answers: comments.length,
      connections,
    },
    skills: profile.skills || [],
    recentActivity,
  }
}

function activeSubscription(db, userId) {
  return (db.subscriptions || []).find(row => (
    row.userId === userId && ['active', 'trialing'].includes(String(row.status || '').toLowerCase())
  )) || null
}

function credibilityLevel(value) {
  const score = boundedNumber(value, 0, 100)
  if (score >= 80) return 'high'
  if (score >= 50) return 'established'
  if (score > 0) return 'building'
  return 'new'
}

function activeMemberships(db, collectionName, userId, key) {
  return new Set((db[collectionName] || [])
    .filter(row => row.userId === userId && !['revoked', 'suspended', 'inactive'].includes(String(row.status || '').toLowerCase()))
    .map(row => row[key])
    .filter(Boolean))
}

function sharedPlatformContext(db, viewerId, candidateId) {
  if (!viewerId || !candidateId || viewerId === candidateId) return false
  const viewerWorkspaces = activeMemberships(db, 'workspaceMembers', viewerId, 'workspaceId')
  const candidateWorkspaces = activeMemberships(db, 'workspaceMembers', candidateId, 'workspaceId')
  for (const id of viewerWorkspaces) if (candidateWorkspaces.has(id)) return true

  const viewerOrganizations = activeMemberships(db, 'organizationMemberships', viewerId, 'organizationId')
  const candidateOrganizations = activeMemberships(db, 'organizationMemberships', candidateId, 'organizationId')
  for (const id of viewerOrganizations) if (candidateOrganizations.has(id)) return true

  const reciprocalConnections = (db.networkEdges || []).filter(edge => edge.type === 'CONNECTS')
  return reciprocalConnections.some(edge => edge.fromEntityId === viewerId && edge.toEntityId === candidateId)
    && reciprocalConnections.some(edge => edge.fromEntityId === candidateId && edge.toEntityId === viewerId)
}

function hasDirectoryRole(profile, role) {
  if (!role) return true
  const roles = [
    profile.role,
    ...(Array.isArray(profile.secondaryRoles) ? profile.secondaryRoles : []),
    ...(Array.isArray(profile.roles) ? profile.roles : []),
  ].map(value => String(value || '').toLowerCase())
  return roles.includes(role)
}

function boundedNumber(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min
}

function plainText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[<>\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function safeStringArray(value, maxItems = 24, maxLength = 80) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => plainText(item, maxLength)).filter(Boolean))].slice(0, maxItems)
}

function directoryProfile(profile, db, viewerId) {
  const subscription = activeSubscription(db, profile.id)
  return {
    id: profile.id,
    name: userName(profile),
    username: profile.username || null,
    role: profile.role || 'collaborator',
    title: profile.title || profile.discipline || '',
    headline: profile.bio || '',
    skills: safeStringArray(profile.skills),
    discipline: plainText(profile.discipline, 80),
    subSkills: safeStringArray(profile.subSkills),
    techStack: safeStringArray(profile.techStack),
    weeklyHours: boundedNumber(profile.weeklyHours, 0, 168),
    timezone: profile.timezone || '',
    location: profile.country || '',
    earliestStart: plainText(profile.earliestStart, 24),
    commitmentStyle: plainText(profile.commitmentStyle, 24),
    equityPreference: boundedNumber(profile.equityPreference, 0, 100),
    minCashFloor: boundedNumber(profile.minCashFloor, 0, 1_000_000),
    industries: safeStringArray(profile.industries, 12),
    avatarUrl: profile.avatarUrl || '',
    credibilityScore: boundedNumber(profile.credibilityScore, 0, 100),
    credibilityLevel: credibilityLevel(profile.credibilityScore),
    isVerified: Boolean(profile.isVerified),
    subscriber: subscription !== null,
    subscriptionLabel: subscription ? 'Subscriber' : null,
    sharedContext: sharedPlatformContext(db, viewerId, profile.id),
  }
}

export async function listUsers(req, res) {
  const requestedRole = String(req.query.role || '').trim().toLowerCase()
  const query = plainText(String(req.query.q || ''), 80).toLowerCase().replace(/^@/, '')
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20) || 20))
  const db = readAuthorityDb()
  let profiles = db.profiles
  if (process.env.IDENTITY_READ_SOURCE === 'postgres') {
    try { profiles = await listIdentityProfiles() } catch (error) { if (process.env.IDENTITY_READ_FALLBACK_SQLITE === 'false') throw error }
  }
  const users = profiles
    .filter(profile => profile.id !== req.user.id && hasDirectoryRole(profile, requestedRole))
    .filter(profile => {
      if (!query) return true
      const haystack = [profile.id, userName(profile), profile.username, profile.title, profile.role, profile.orgName]
        .filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query)
    })
    .map(profile => directoryProfile(profile, db, req.user.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit)
  return res.json({ users })
}

export async function getUserProfile(req, res) {
  const db = readAuthorityDb()
  const id = req.params.id === 'me' ? req.user.id : req.params.id
  let profile
  if (process.env.IDENTITY_READ_SOURCE === 'postgres') {
    try { profile = (await listIdentityProfiles()).find(p => p.id === id || p.username === id) } catch (error) { if (process.env.IDENTITY_READ_FALLBACK_SQLITE === 'false') throw error }
  }
  profile ||= db.profiles.find(p => p.id === id || p.username === id)
  if (!profile) return res.status(404).json({ error: 'Profile not found' })
  return res.json(publicProfile(profile, db, req.user.id))
}

function normalizeInvitation(value) {
  if (value === undefined || value === null) return { invitation: null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Invalid collaboration invitation' }
  const invitation = {
    projectId: plainText(value.projectId, 100),
    projectName: plainText(value.projectName, 120),
    summary: plainText(value.summary, 500),
    scope: plainText(value.scope, 1000),
    requestedRole: plainText(value.requestedRole, 80),
    requiredSkills: safeStringArray(value.requiredSkills, 12, 50),
    compensationMode: ['equity-heavy', 'equity-cash', 'cash-only'].includes(value.compensationMode)
      ? value.compensationMode
      : 'equity-heavy',
    equityProposal: boundedNumber(value.equityProposal, 0, 30),
    cashReward: boundedNumber(value.cashReward, 0, 1_000_000),
  }
  if (invitation.compensationMode === 'cash-only') invitation.equityProposal = 0
  if (invitation.compensationMode === 'equity-heavy') invitation.cashReward = 0
  if (!invitation.projectId || !invitation.projectName || !invitation.summary || !invitation.scope || !invitation.requestedRole) {
    return { error: 'Project, summary, scope and requested role are required' }
  }
  if (invitation.compensationMode !== 'cash-only' && invitation.equityProposal <= 0) {
    return { error: 'An ownership proposal is required' }
  }
  if (invitation.compensationMode !== 'equity-heavy' && invitation.cashReward <= 0) {
    return { error: 'Cash support is required for this offer type' }
  }
  return { invitation }
}

function invitationContent(invitation) {
  const ownership = invitation.equityProposal > 0 ? `${invitation.equityProposal}% proposed ownership` : ''
  const cashSupport = invitation.cashReward > 0 ? `$${invitation.cashReward.toLocaleString('en-US')}/month optional cash support` : ''
  const compensation = [ownership, cashSupport].filter(Boolean).join(' + ')
  return [
    `invites you as ${invitation.requestedRole} for ${invitation.projectName}.`,
    invitation.summary,
    `Scope: ${invitation.scope}`,
    compensation ? `Non-binding ownership proposal: ${compensation}.` : 'Ownership terms are open for discussion.',
  ].join(' ')
}

export function connectUser(req, res) {
  const normalized = normalizeInvitation(req.body?.invitation)
  if (normalized.error) return res.status(400).json({ error: normalized.error })
  const invitation = normalized.invitation
  const result = updateAuthorityDb(db => {
    const target = db.profiles.find(p => p.id === req.params.id || p.username === req.params.id)
    const actor = db.profiles.find(p => p.id === req.user.id)
    if (!target) return { status: 404, error: 'Profile not found' }
    if (target.id === req.user.id) return { status: 400, error: 'Cannot connect with yourself' }
    const exists = db.notifications.some(n =>
      n.userId === target.id &&
      n.actorId === req.user.id &&
      n.type === 'collab' &&
      n.linkTo === `/feed/profile/${req.user.id}` &&
      (invitation
        ? n.metadata?.invitation?.projectId === invitation.projectId
        : !n.metadata?.invitation)
    )
    if (!exists) {
      db.notifications.push({
        id: createId('notif'),
        userId: target.id,
        actorId: req.user.id,
        type: 'collab',
        read: false,
        content: invitation ? invitationContent(invitation) : 'wants to connect with you',
        author: userName(actor),
        avatar: avatarGradient(req.user.id),
        linkTo: `/feed/profile/${req.user.id}`,
        metadata: invitation ? { invitation } : undefined,
        createdAt: nowIso(),
      })
    }
    const event = appendPlatformEventInDb(db, {
      userId: req.user.id,
      actorId: req.user.id,
      eventType: 'connect',
      entityType: 'person',
      entityId: target.id,
      importance: 'HIGH',
      metadata: { targetName: userName(target) },
    })
    appendRelationshipInDb(db, req.user.id, event)
    return { status: 200 }
  })
  if (result.status !== 200) return res.status(result.status).json({ error: result.error })
  return res.json({ ok: true })
}
