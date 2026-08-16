import { createHash } from 'crypto'
import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso, userName } from '../utils/api.js'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export const REASON_TYPES = new Set([
  'SHARED_INTEREST',
  'COMPLEMENTARY_SKILLS',
  'MUTUAL_CONNECTION',
  'SAME_INDUSTRY',
  'SAME_GEOGRAPHY',
  'SIMILAR_ACTIVITY',
  'STARTUP_RELEVANCE',
  'INVESTMENT_THESIS_MATCH',
  'PROJECT_SKILL_MATCH',
  'NETWORK_PROXIMITY',
  'TRENDING_IN_YOUR_AREA',
  'RECENT_ACTIVITY',
  'COLLABORATION_POTENTIAL',
])

const FEEDBACK_TYPES = new Set([
  'not_interested', 'hide', 'dismiss', 'dont_recommend_type', 'mute', 'report', 'undo',
])

const EVENT_STRENGTH = {
  impression: 0.02,
  view: 0.08,
  profile_view: 0.1,
  click: 0.12,
  like: 0.25,
  save: 0.5,
  share: 0.45,
  comment: 0.35,
  follow: 0.65,
  connect: 0.8,
  message: 0.85,
  apply: 1,
  join: 1,
  invest: 1,
  successful_collaboration: 1,
  hide: -0.4,
  not_interested: -0.65,
  unfollow: -0.55,
  remove_connection: -0.65,
  report: -1,
}

const ROLE_INTENTS = {
  explorer: ['explore ideas', 'discover startups', 'find opportunities', 'learn'],
  founder: ['find collaborators', 'find investors', 'find a co-founder', 'build a startup'],
  collaborator: ['find projects', 'share expertise', 'find opportunities', 'find founders'],
  investor: ['discover startups', 'find investment opportunities', 'meet founders'],
  organization: ['find partnerships', 'discover startups', 'find talent', 'build ecosystem'],
}

export const DEFAULT_DISCOVERY_CONFIG = {
  version: 'discovery-v1',
  limits: {
    default: 20,
    maximum: 50,
    returnWindow: 30,
    maxPerCreator: 2,
    maxImpressions: 5,
    cooldownHours: 72,
  },
  inactivity: [
    { state: 'NORMAL', minHours: 0 },
    { state: 'SINCE_LAST_VISIT', minHours: 24 },
    { state: 'WHAT_YOU_MISSED', minHours: 72 },
    { state: 'NETWORK_CHANGED', minHours: 168 },
    { state: 'SIGNIFICANT_CHANGES', minHours: 336 },
    { state: 'WELCOME_BACK', minHours: 720 },
  ],
  weights: {
    base: {
      roleCompatibility: 0.14,
      interestSimilarity: 0.12,
      skillCompatibility: 0.14,
      intentCompatibility: 0.1,
      industryRelevance: 0.09,
      geographicRelevance: 0.04,
      networkProximity: 0.07,
      behavioralSimilarity: 0.08,
      startupRelevance: 0.05,
      gsisRelevance: 0.04,
      trust: 0.07,
      activityRecency: 0.06,
      collaborationProbability: 0.08,
      negativeSignals: 0.2,
      repetitionPenalty: 0.12,
      staleness: 0.06,
    },
    explorer: { interestSimilarity: 0.18, behavioralSimilarity: 0.13, gsisRelevance: 0.02 },
    founder: { skillCompatibility: 0.2, intentCompatibility: 0.14, collaborationProbability: 0.14 },
    collaborator: { skillCompatibility: 0.24, collaborationProbability: 0.16, gsisRelevance: 0.02 },
    investor: { startupRelevance: 0.12, gsisRelevance: 0.13, trust: 0.1 },
    organization: { industryRelevance: 0.14, collaborationProbability: 0.13, trust: 0.1 },
  },
  diversity: {
    explorer: { person: 0.25, startup: 0.2, project: 0.15, opportunity: 0.15, idea: 0.1, organization: 0.1, content: 0.05 },
    founder: { person: 0.45, opportunity: 0.15, startup: 0.12, project: 0.1, organization: 0.1, idea: 0.05, content: 0.03 },
    collaborator: { project: 0.25, opportunity: 0.25, startup: 0.18, person: 0.2, idea: 0.07, content: 0.05 },
    investor: { startup: 0.4, person: 0.2, opportunity: 0.15, idea: 0.1, organization: 0.08, content: 0.07 },
    organization: { startup: 0.25, organization: 0.2, person: 0.2, opportunity: 0.15, project: 0.12, idea: 0.08 },
  },
}

function rows(db, name) {
  if (!Array.isArray(db[name])) db[name] = []
  return db[name]
}

function normalizeRole(value) {
  const role = String(value || 'explorer').toLowerCase()
  if (role === 'user' || role === 'explorer') return 'explorer'
  if (role === 'organisation' || role === 'organization') return 'organization'
  if (['founder', 'collaborator', 'investor'].includes(role)) return role
  return 'explorer'
}

function normalizeType(value) {
  const type = String(value || '').toLowerCase()
  if (type === 'people' || type === 'founder' || type === 'collaborator' || type === 'investor') return 'person'
  if (type === 'startups') return 'startup'
  if (type === 'projects') return 'project'
  if (type === 'ideas') return 'idea'
  if (type === 'opportunities') return 'opportunity'
  if (type === 'organizations' || type === 'organisation') return 'organization'
  if (type === 'posts') return 'content'
  return type
}

function words(values) {
  const input = Array.isArray(values) ? values : values == null ? [] : [values]
  return [...new Set(input.flatMap(value => String(value || '').split(/[,|]/)).map(value => value.trim().toLowerCase()).filter(Boolean))]
}

function scoreMap(values, defaultScore = 0.7) {
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [String(key).toLowerCase(), clamp(value)]))
  }
  return Object.fromEntries(words(values).map(value => [value, defaultScore]))
}

function mergeScoreMaps(...maps) {
  const result = {}
  for (const map of maps) {
    for (const [key, value] of Object.entries(map || {})) result[key] = Math.max(result[key] || 0, clamp(value))
  }
  return result
}

function clamp(value, min = 0, max = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.max(min, Math.min(max, number))
}

function overlap(left, right) {
  const a = new Set(words(left))
  const b = new Set(words(right))
  if (!a.size || !b.size) return 0
  let matches = 0
  for (const value of a) if (b.has(value)) matches += 1
  return matches / Math.max(1, Math.min(a.size, b.size))
}

function recency(iso, halfLifeDays = 30) {
  const time = new Date(iso || 0).getTime()
  if (!Number.isFinite(time) || time <= 0) return 0
  const ageDays = Math.max(0, (Date.now() - time) / DAY_MS)
  return Math.exp(-ageDays / halfLifeDays)
}

function stableId(...parts) {
  return `rec_${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)}`
}

function getConfigInDb(db) {
  const stored = rows(db, 'recommendationConfigs').find(item => item.id === 'default')
  return stored ? deepMerge(DEFAULT_DISCOVERY_CONFIG, stored.value || {}) : structuredClone(DEFAULT_DISCOVERY_CONFIG)
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return structuredClone(base)
  const result = structuredClone(base)
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], value)
    } else {
      result[key] = structuredClone(value)
    }
  }
  return result
}

function roleIntentScores(role) {
  return scoreMap(ROLE_INTENTS[role] || ROLE_INTENTS.explorer, 0.65)
}

function replaceSignalRows(db, collectionName, userId, signalMap) {
  db[collectionName] = rows(db, collectionName).filter(row => row.userId !== userId)
  for (const [key, score] of Object.entries(signalMap)) {
    db[collectionName].push({ id: createId(collectionName.slice(0, -1)), userId, key, score, updatedAt: nowIso() })
  }
}

export function syncRecommendationProfileInDb(db, userId, explicit = {}) {
  const profile = rows(db, 'profiles').find(item => item.id === userId)
  if (!profile) return null
  const profiles = rows(db, 'recommendationProfiles')
  const existing = profiles.find(item => item.userId === userId)
  const role = normalizeRole(profile.role)
  if (existing?.role && existing.role !== role) {
    appendPlatformEventInDb(db, {
      userId,
      actorId: userId,
      eventType: 'role_changed',
      entityType: 'person',
      entityId: userId,
      importance: 'HIGH',
      metadata: { previousRole: existing.role, role },
    })
  }
  const interests = mergeScoreMaps(
    scoreMap(profile.industries, 0.72),
    scoreMap(profile.investmentFocus, role === 'investor' ? 0.85 : 0.68),
    scoreMap(existing?.interests),
    scoreMap(explicit.interests),
  )
  const skills = mergeScoreMaps(
    scoreMap(profile.skills, 0.82),
    scoreMap(profile.subSkills, 0.76),
    scoreMap(profile.techStack, 0.76),
    scoreMap(existing?.skills),
    scoreMap(explicit.skills),
  )
  const intent = mergeScoreMaps(
    roleIntentScores(role),
    scoreMap(existing?.intent),
    scoreMap(explicit.intent || explicit.intents, 0.9),
  )
  const next = {
    id: existing?.id || createId('rec_profile'),
    userId,
    role,
    interests,
    skills,
    intent,
    preferredIndustries: words(explicit.preferredIndustries || profile.industries || existing?.preferredIndustries),
    preferredCollaboration: words(explicit.preferredCollaboration || [profile.commitmentStyle, profile.timezone]),
    recentInterests: existing?.recentInterests || {},
    onboardingComplete: Boolean(profile.isOnboarded),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  }
  if (existing) Object.assign(existing, next)
  else profiles.push(next)
  replaceSignalRows(db, 'userInterests', userId, interests)
  replaceSignalRows(db, 'userSkills', userId, skills)
  replaceSignalRows(db, 'userIntents', userId, intent)
  return next
}

function profileSignalKeys(profile, name) {
  return Object.keys(profile?.[name] || {})
}

function candidateTags(candidate) {
  return words([
    ...(candidate.tags || []),
    ...(candidate.skills || []),
    ...(candidate.industries || []),
    candidate.industry,
    candidate.stage,
  ])
}

function isSafe(record) {
  const status = String(record.accountStatus || record.moderationStatus || record.status || '').toLowerCase()
  if (['blocked', 'suspended', 'banned', 'spam', 'removed'].includes(status)) return false
  if (record.active === false || record.isActive === false) return false
  if (Number(record.abuseScore || record.spamScore || 0) >= 5) return false
  return true
}

function isDiscoverable(record) {
  const visibility = String(record.visibility || '').toLowerCase()
  const status = String(record.status || '').toLowerCase()
  if (visibility && !['public', 'published', 'platform'].includes(visibility)) return false
  if (record.private === true || record.isPrivate === true) return false
  if (['draft', 'archived', 'closed', 'cancelled', 'canceled'].includes(status)) return false
  return true
}

function ownerProfile(db, record) {
  const ownerId = record.ownerId || record.founderId || record.organizationId || record.userId || record.createdBy || record.authorId
  return rows(db, 'profiles').find(profile => profile.id === ownerId) || null
}

function projectType(project, owner) {
  const explicit = normalizeType(project.entityType || project.kind || project.type)
  if (['startup', 'project', 'idea'].includes(explicit)) return explicit
  if (String(project.stage || '').toLowerCase() === 'idea' && project.ideaOnly === true) return 'idea'
  return normalizeRole(owner?.role) === 'founder' || project.gsisScore != null ? 'startup' : 'project'
}

function entityUrl(type, id, viewerRole) {
  if (type === 'person' || type === 'organization') return `/feed/profile/${id}`
  if (type === 'startup' && viewerRole === 'investor') return `/investor/startup/${id}`
  if (type === 'opportunity') return `/opportunity-hub/${id}`
  if (type === 'content') return `/feed/post/${id}`
  if (type === 'project') return `/workspaces?project=${encodeURIComponent(id)}`
  return '/feed'
}

function makeActions(type, candidateRole, viewerRole, id, url) {
  if (type === 'person') {
    if (candidateRole === 'investor' && viewerRole === 'founder') return [
      { id: 'view', label: 'View Profile', href: url },
      { id: 'introduction', label: 'Request Introduction', href: url },
    ]
    return [
      { id: 'view', label: 'View Profile', href: url },
      { id: 'connect', label: 'Connect', href: url },
      { id: 'follow', label: 'Follow', href: url },
    ]
  }
  if (type === 'startup') return [{ id: 'explore', label: viewerRole === 'investor' ? 'View Deal' : 'Explore', href: url }]
  if (type === 'opportunity') return [{ id: 'view', label: 'View Opportunity', href: url }, { id: 'apply', label: 'Apply', href: url }]
  if (type === 'project') return [{ id: 'view', label: 'View Project', href: url }, { id: 'apply', label: 'Apply', href: url }]
  if (type === 'organization') return [{ id: 'view', label: 'View Organization', href: url }, { id: 'partner', label: 'Partner', href: url }]
  if (type === 'content') return [{ id: 'view', label: 'Read', href: url }, { id: 'save', label: 'Save', href: url }]
  return [{ id: 'explore', label: 'Explore', href: url }]
}

function buildCandidates(db, userId, viewerRole) {
  const candidates = []
  for (const profile of rows(db, 'profiles')) {
    if (profile.id === userId || !isSafe(profile)) continue
    const candidateRole = normalizeRole(profile.role)
    const type = candidateRole === 'organization' ? 'organization' : 'person'
    const url = entityUrl(type, profile.id, viewerRole)
    candidates.push({
      entityId: profile.id,
      type,
      role: candidateRole,
      title: candidateRole === 'organization' ? (profile.orgName || userName(profile)) : userName(profile),
      subtitle: profile.title || profile.discipline || profile.bio || candidateRole,
      description: profile.bio || '',
      skills: words([...(profile.skills || []), ...(profile.subSkills || []), ...(profile.techStack || [])]),
      industries: words([...(profile.industries || []), ...(profile.investmentFocus || [])]),
      geography: profile.country || '',
      timezone: profile.timezone || '',
      trustScore: clamp((Number(profile.credibilityScore || 0) + (profile.isVerified ? 100 : 30)) / 200),
      commitment: profile.weeklyHours || profile.commitmentStyle || '',
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      creatorId: profile.id,
      url,
      actions: makeActions(type, candidateRole, viewerRole, profile.id, url),
    })
  }

  for (const project of rows(db, 'projects')) {
    const owner = ownerProfile(db, project)
    const ownerId = owner?.id || project.ownerId || project.organizationId
    if (ownerId === userId || !isSafe(project) || !isSafe(owner || {}) || !isDiscoverable(project)) continue
    const type = projectType(project, owner)
    const url = entityUrl(type, project.id, viewerRole)
    candidates.push({
      entityId: project.id,
      type,
      role: normalizeRole(owner?.role),
      title: project.title || project.name || 'Untitled project',
      subtitle: [project.industry, project.stage].filter(Boolean).join(' · '),
      description: project.tagline || project.description || '',
      skills: words(project.requiredSkills || project.skills || project.techStack),
      industries: words(project.industry || project.industries),
      geography: project.country || owner?.country || '',
      stage: project.stage || '',
      gsis: clamp(Number(project.gsisScore || project.gsis || 0) / 100),
      trustScore: clamp((Number(owner?.credibilityScore || 0) + (owner?.isVerified ? 100 : 30)) / 200),
      commitment: project.commitment || project.weeklyHours || '',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      creatorId: ownerId,
      url,
      actions: makeActions(type, normalizeRole(owner?.role), viewerRole, project.id, url),
    })
  }

  for (const opportunity of rows(db, 'opportunities')) {
    const owner = ownerProfile(db, opportunity)
    const ownerId = owner?.id || opportunity.ownerId || opportunity.createdBy
    const expiresAt = new Date(opportunity.expiresAt || opportunity.deadline || '2999-01-01').getTime()
    if (ownerId === userId || !isSafe(opportunity) || !isDiscoverable(opportunity) || expiresAt < Date.now()) continue
    const url = entityUrl('opportunity', opportunity.id, viewerRole)
    candidates.push({
      entityId: opportunity.id,
      type: 'opportunity',
      role: normalizeRole(owner?.role),
      title: opportunity.title || opportunity.name || 'Opportunity',
      subtitle: opportunity.type || opportunity.commitment || opportunity.stage || '',
      description: opportunity.description || opportunity.summary || '',
      skills: words(opportunity.requiredSkills || opportunity.skills || opportunity.techStack),
      industries: words(opportunity.industry || opportunity.industries || opportunity.tags),
      geography: opportunity.location || opportunity.country || owner?.country || '',
      stage: opportunity.stage || '',
      trustScore: clamp((Number(owner?.credibilityScore || 0) + (owner?.isVerified ? 100 : 30)) / 200),
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
      creatorId: ownerId,
      importance: String(opportunity.importance || '').toUpperCase(),
      url,
      actions: makeActions('opportunity', normalizeRole(owner?.role), viewerRole, opportunity.id, url),
    })
  }

  for (const idea of rows(db, 'ventureIntakes')) {
    const owner = ownerProfile(db, idea)
    const ownerId = owner?.id || idea.ownerId || idea.userId
    if (ownerId === userId || !isSafe(idea) || !isDiscoverable(idea)) continue
    const url = entityUrl('idea', idea.id, viewerRole)
    candidates.push({
      entityId: idea.id,
      type: 'idea',
      role: normalizeRole(owner?.role),
      title: idea.title || idea.name || idea.problem || 'Startup idea',
      subtitle: idea.industry || idea.market || '',
      description: idea.description || idea.solution || idea.oneLiner || '',
      skills: words(idea.skills),
      industries: words(idea.industry || idea.industries || idea.tags),
      geography: idea.country || owner?.country || '',
      createdAt: idea.createdAt,
      updatedAt: idea.updatedAt,
      creatorId: ownerId,
      url,
      actions: makeActions('idea', normalizeRole(owner?.role), viewerRole, idea.id, url),
    })
  }

  for (const post of rows(db, 'feedPosts')) {
    const owner = ownerProfile(db, post)
    if (post.authorId === userId || !isSafe(post) || !isSafe(owner || {}) || !isDiscoverable(post)) continue
    const url = entityUrl('content', post.id, viewerRole)
    candidates.push({
      entityId: post.id,
      type: 'content',
      role: normalizeRole(owner?.role),
      title: post.title || String(post.body || '').slice(0, 90) || 'Feed update',
      subtitle: userName(owner, 'TechIT member'),
      description: post.body || '',
      skills: [],
      industries: words(post.tags || post.industry),
      geography: owner?.country || '',
      trustScore: clamp((Number(owner?.credibilityScore || 0) + (owner?.isVerified ? 100 : 30)) / 200),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      creatorId: post.authorId,
      url,
      actions: makeActions('content', normalizeRole(owner?.role), viewerRole, post.id, url),
    })
  }
  return candidates
}

function roleCompatibility(viewerRole, candidate) {
  const typeWeights = {
    explorer: { person: 0.9, startup: 0.85, project: 0.8, opportunity: 0.85, idea: 0.85, organization: 0.7, content: 0.75 },
    founder: { person: 0.85, startup: 0.55, project: 0.75, opportunity: 0.8, idea: 0.65, organization: 0.75, content: 0.55 },
    collaborator: { person: 0.75, startup: 0.9, project: 1, opportunity: 1, idea: 0.75, organization: 0.65, content: 0.5 },
    investor: { person: 0.75, startup: 1, project: 0.65, opportunity: 0.9, idea: 0.8, organization: 0.7, content: 0.55 },
    organization: { person: 0.8, startup: 0.9, project: 0.85, opportunity: 0.9, idea: 0.75, organization: 1, content: 0.45 },
  }
  let score = typeWeights[viewerRole]?.[candidate.type] ?? 0.5
  if (candidate.type === 'person') {
    if (viewerRole === 'founder' && candidate.role === 'collaborator') score = 1
    if (viewerRole === 'founder' && candidate.role === 'investor') score = 0.95
    if (viewerRole === 'collaborator' && candidate.role === 'founder') score = 0.95
    if (viewerRole === 'investor' && candidate.role === 'founder') score = 1
  }
  return score
}

function relationshipFeatures(db, userId, candidate) {
  const edges = rows(db, 'networkEdges')
  const direct = edges.some(edge => (
    edge.fromEntityId === userId && edge.toEntityId === candidate.creatorId
  ) || (
    edge.toEntityId === userId && edge.fromEntityId === candidate.creatorId
  ))
  const neighbors = new Set(edges.filter(edge => edge.fromEntityId === userId).map(edge => edge.toEntityId))
  let mutual = 0
  for (const edge of edges) {
    if (edge.fromEntityId === candidate.creatorId && neighbors.has(edge.toEntityId)) mutual += 1
  }
  return { direct: direct ? 1 : 0, mutual: clamp(mutual / 3), mutualCount: mutual }
}

function featureWeights(config, role) {
  return { ...config.weights.base, ...(config.weights[role] || {}) }
}

function feedbackPenalty(db, userId, candidate) {
  const feedback = rows(db, 'recommendationFeedback').filter(item => item.userId === userId && !item.undoneAt)
  const exact = feedback.filter(item => item.entityId === candidate.entityId && item.entityType === candidate.type)
  if (exact.some(item => ['report', 'mute', 'hide', 'not_interested', 'dismiss'].includes(item.type))) return 1
  const preference = rows(db, 'recommendationPreferences').find(item => item.userId === userId)
  if ((preference?.mutedTypes || []).includes(candidate.type)) return 1
  return 0
}

function exposurePenalty(db, userId, candidate, config) {
  const exposures = rows(db, 'recommendationExposures').filter(item => item.userId === userId && item.entityId === candidate.entityId && item.entityType === candidate.type)
  if (!exposures.length) return { penalty: 0, blocked: false, count: 0 }
  const latest = Math.max(...exposures.map(item => new Date(item.createdAt).getTime()))
  const hours = (Date.now() - latest) / HOUR_MS
  const count = exposures.length
  return {
    penalty: clamp(count / Math.max(1, config.limits.maxImpressions)),
    blocked: count >= config.limits.maxImpressions && hours < config.limits.cooldownHours,
    count,
  }
}

function explanationFor(features, candidate, relationship) {
  if (features.skillCompatibility >= 0.5 && ['project', 'opportunity'].includes(candidate.type)) {
    return { type: 'PROJECT_SKILL_MATCH', text: 'Your skills match what this opportunity needs.' }
  }
  if (features.skillCompatibility >= 0.5 && candidate.type === 'person') {
    return { type: 'COMPLEMENTARY_SKILLS', text: 'Your capabilities could complement each other.' }
  }
  if (features.startupRelevance >= 0.5 && candidate.type === 'startup') {
    return { type: 'INVESTMENT_THESIS_MATCH', text: 'This startup aligns with your investment interests.' }
  }
  if (relationship.mutualCount > 0) {
    return { type: 'MUTUAL_CONNECTION', text: `You have ${relationship.mutualCount} mutual connection${relationship.mutualCount === 1 ? '' : 's'}.` }
  }
  if (features.interestSimilarity >= 0.45) return { type: 'SHARED_INTEREST', text: 'This matches interests in your TechIT profile.' }
  if (features.industryRelevance >= 0.45) return { type: 'SAME_INDUSTRY', text: 'This is active in an industry you follow.' }
  if (features.geographicRelevance > 0) return { type: 'SAME_GEOGRAPHY', text: 'This is relevant to your geography.' }
  if (features.collaborationProbability >= 0.5) return { type: 'COLLABORATION_POTENTIAL', text: 'There is a strong potential for you to create value together.' }
  return { type: 'RECENT_ACTIVITY', text: 'This is relevant recent activity on TechIT.' }
}

function scoreCandidate(db, userId, recommendationProfile, candidate, config, surface) {
  const viewer = rows(db, 'profiles').find(item => item.id === userId) || {}
  const viewerRole = recommendationProfile.role
  const interestKeys = profileSignalKeys(recommendationProfile, 'interests')
  const skillKeys = profileSignalKeys(recommendationProfile, 'skills')
  const intentKeys = profileSignalKeys(recommendationProfile, 'intent')
  const tags = candidateTags(candidate)
  const relationship = relationshipFeatures(db, userId, candidate)
  const alreadyConnected = candidate.type === 'person' && rows(db, 'networkEdges').some(edge => (
    edge.type === 'CONNECTS' && ((edge.fromEntityId === userId && edge.toEntityId === candidate.entityId) || (edge.toEntityId === userId && edge.fromEntityId === candidate.entityId))
  ))
  if (alreadyConnected) return null
  const negativeSignals = feedbackPenalty(db, userId, candidate)
  const exposure = exposurePenalty(db, userId, candidate, config)
  if (negativeSignals >= 1 || exposure.blocked) return null

  const skillMatch = overlap(skillKeys, candidate.skills)
  const interestMatch = overlap(interestKeys, tags)
  const industryMatch = overlap(recommendationProfile.preferredIndustries || interestKeys, candidate.industries)
  const intentMatch = candidate.type === 'opportunity' || candidate.type === 'project'
    ? Math.max(overlap(intentKeys, ['find opportunities', 'find projects', 'find collaborators']), skillMatch)
    : overlap(intentKeys, tags)
  const features = {
    roleCompatibility: roleCompatibility(viewerRole, candidate),
    interestSimilarity: interestMatch,
    skillCompatibility: skillMatch,
    intentCompatibility: intentMatch,
    industryRelevance: industryMatch,
    geographicRelevance: viewer.country && candidate.geography && String(viewer.country).toLowerCase() === String(candidate.geography).toLowerCase() ? 1 : 0,
    networkProximity: Math.max(relationship.direct * 0.8, relationship.mutual),
    behavioralSimilarity: overlap(Object.keys(recommendationProfile.recentInterests || {}), tags),
    startupRelevance: candidate.type === 'startup' ? Math.max(interestMatch, industryMatch) : 0,
    gsisRelevance: candidate.gsis || 0,
    trust: candidate.trustScore ?? 0.5,
    activityRecency: recency(candidate.updatedAt || candidate.createdAt),
    collaborationProbability: Math.max(skillMatch, intentMatch) * (candidate.type === 'content' ? 0.25 : 1),
    negativeSignals,
    repetitionPenalty: exposure.penalty,
    staleness: 1 - recency(candidate.updatedAt || candidate.createdAt, 90),
  }
  const weights = featureWeights(config, viewerRole)
  let score = 0
  for (const [name, value] of Object.entries(features)) {
    const direction = ['negativeSignals', 'repetitionPenalty', 'staleness'].includes(name) ? -1 : 1
    score += direction * Number(weights[name] || 0) * value
  }
  if (surface === 'feed' && candidate.type === 'content') score += 0.05
  if (surface === 'deal-intelligence' && candidate.type === 'startup') score += 0.08
  const reason = explanationFor(features, candidate, relationship)
  return { score: Math.round(clamp(score, 0, 1) * 1000) / 1000, features, reason }
}

function diversify(scored, role, limit, config) {
  const mix = config.diversity[role] || config.diversity.explorer
  const typeCount = {}
  const creatorCount = {}
  const selected = []
  const deferred = []
  for (const item of scored) {
    const maxType = Math.max(1, Math.ceil(limit * (mix[item.entity.type] || 0.1)))
    const creatorKey = item.entity.creatorId || item.entity.entityId
    if ((typeCount[item.entity.type] || 0) >= maxType || (creatorCount[creatorKey] || 0) >= config.limits.maxPerCreator) {
      deferred.push(item)
      continue
    }
    selected.push(item)
    typeCount[item.entity.type] = (typeCount[item.entity.type] || 0) + 1
    creatorCount[creatorKey] = (creatorCount[creatorKey] || 0) + 1
    if (selected.length >= limit) return selected
  }
  for (const item of deferred) {
    if (selected.length >= limit) break
    if (!selected.some(row => row.entity.entityId === item.entity.entityId && row.entity.type === item.entity.type)) selected.push(item)
  }
  return selected
}

function persistRecommendations(db, userId, surface, selected, config) {
  const recommendations = rows(db, 'recommendations')
  const reasons = rows(db, 'recommendationReasons')
  return selected.map((item, rank) => {
    const id = stableId(userId, surface, item.entity.type, item.entity.entityId)
    const existing = recommendations.find(row => row.id === id)
    const record = {
      id,
      userId,
      surface,
      entityType: item.entity.type,
      entityId: item.entity.entityId,
      score: item.score,
      rank: rank + 1,
      reasonType: item.reason.type,
      reasonText: item.reason.text,
      features: item.features,
      entity: item.entity,
      configVersion: config.version,
      generatedAt: nowIso(),
      expiresAt: new Date(Date.now() + 24 * HOUR_MS).toISOString(),
    }
    if (existing) Object.assign(existing, record)
    else {
      recommendations.push(record)
      appendPlatformEventInDb(db, {
        userId,
        actorId: userId,
        eventType: 'recommendation_generated',
        entityType: record.entityType,
        entityId: record.entityId,
        surface,
        importance: 'LOW',
        metadata: { recommendationId: id, score: record.score, reasonType: record.reasonType },
      })
    }
    const reason = reasons.find(row => row.recommendationId === id)
    const reasonRecord = { id: reason?.id || createId('rec_reason'), recommendationId: id, type: item.reason.type, text: item.reason.text, createdAt: reason?.createdAt || nowIso(), updatedAt: nowIso() }
    if (reason) Object.assign(reason, reasonRecord)
    else reasons.push(reasonRecord)
    return record
  })
}

function generateRecommendationsInDb(db, userId, options = {}) {
  const config = getConfigInDb(db)
  const recommendationProfile = syncRecommendationProfileInDb(db, userId, options.profile || {})
  if (!recommendationProfile) return { recommendations: [], meta: { totalCandidates: 0 } }
  const requestedType = normalizeType(options.type)
  const requestedLimit = Number(options.limit || config.limits.default)
  const limit = Math.max(1, Math.min(config.limits.maximum, Number.isFinite(requestedLimit) ? requestedLimit : config.limits.default))
  const surface = String(options.surface || 'discovery').toLowerCase()
  const candidates = buildCandidates(db, userId, recommendationProfile.role)
    .filter(candidate => !requestedType || candidate.type === requestedType)
  const scored = candidates
    .map(entity => {
      const result = scoreCandidate(db, userId, recommendationProfile, entity, config, surface)
      return result ? { entity, ...result } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.entity.entityId).localeCompare(String(b.entity.entityId)))
  const selected = requestedType ? scored.slice(0, limit) : diversify(scored, recommendationProfile.role, limit, config)
  return {
    recommendations: persistRecommendations(db, userId, surface, selected, config),
    profile: recommendationProfile,
    meta: {
      role: recommendationProfile.role,
      surface,
      totalCandidates: candidates.length,
      returned: selected.length,
      configVersion: config.version,
      coldStart: rows(db, 'recommendationEvents').filter(event => event.userId === userId).length < 5,
    },
  }
}

export function getRecommendations(userId, options = {}) {
  return updateDb(db => generateRecommendationsInDb(db, userId, options))
}

export function updateRecommendationProfile(userId, body = {}) {
  return updateDb(db => {
    const profile = syncRecommendationProfileInDb(db, userId, body)
    if (!profile) return null
    const preferences = rows(db, 'recommendationPreferences')
    let preference = preferences.find(item => item.userId === userId)
    if (!preference) {
      preference = { id: createId('rec_pref'), userId, mutedTypes: [], createdAt: nowIso() }
      preferences.push(preference)
    }
    if (Array.isArray(body.mutedTypes)) preference.mutedTypes = words(body.mutedTypes).map(normalizeType)
    preference.updatedAt = nowIso()
    return profile
  })
}

function appendEdge(db, userId, event) {
  if (!event.entityId || !['follow', 'connect', 'message', 'apply', 'join', 'invest', 'successful_collaboration'].includes(event.eventType)) return
  const edges = rows(db, 'networkEdges')
  const edgeType = {
    follow: 'FOLLOWS', connect: 'CONNECTS', message: 'INTERACTS_WITH', apply: 'APPLIED', join: 'JOINED', invest: 'INVESTS_IN', successful_collaboration: 'COLLABORATES_WITH',
  }[event.eventType]
  const existing = edges.find(edge => edge.fromEntityId === userId && edge.toEntityId === event.entityId && edge.type === edgeType)
  const edge = {
    id: existing?.id || createId('edge'),
    fromEntityId: userId,
    fromEntityType: 'person',
    toEntityId: event.entityId,
    toEntityType: normalizeType(event.entityType),
    type: edgeType,
    strength: Math.max(existing?.strength || 0, Math.abs(EVENT_STRENGTH[event.eventType] || 0.1)),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  }
  if (existing) Object.assign(existing, edge)
  else edges.push(edge)
  const relationships = rows(db, 'entityRelationships')
  const relationship = relationships.find(item => item.userId === userId && item.entityId === event.entityId && item.type === edgeType)
  if (relationship) Object.assign(relationship, { strength: edge.strength, updatedAt: nowIso() })
  else relationships.push({ id: createId('relationship'), userId, entityId: event.entityId, entityType: normalizeType(event.entityType), type: edgeType, strength: edge.strength, createdAt: nowIso(), updatedAt: nowIso() })
}

export function appendRelationshipInDb(db, userId, event) {
  appendEdge(db, userId, event)
  return event
}

function updateBehaviorSignals(profile, event) {
  const strength = EVENT_STRENGTH[event.eventType] || 0
  const topics = words([...(event.metadata?.tags || []), ...(event.metadata?.industries || []), event.metadata?.industry, event.metadata?.topic])
  const skills = words(event.metadata?.skills)
  profile.recentInterests ||= {}
  for (const topic of topics) profile.recentInterests[topic] = clamp((profile.recentInterests[topic] || 0) + strength * 0.2)
  for (const skill of skills) profile.skills[skill] = clamp((profile.skills[skill] || 0) + strength * 0.15)
  profile.updatedAt = nowIso()
}

export function appendPlatformEventInDb(db, event) {
  const record = {
    id: event.id || createId('rec_event'),
    userId: event.userId || null,
    actorId: event.actorId || event.userId || null,
    eventType: String(event.eventType || 'platform_event').toLowerCase(),
    entityType: normalizeType(event.entityType),
    entityId: event.entityId || null,
    importance: String(event.importance || 'MEDIUM').toUpperCase(),
    surface: event.surface || 'platform',
    metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {},
    createdAt: event.createdAt || nowIso(),
  }
  const events = rows(db, 'recommendationEvents')
  events.push(record)
  if (events.length > 20_000) events.splice(0, events.length - 20_000)
  return record
}

export function recordRecommendationEvent(userId, body = {}) {
  const eventType = String(body.eventType || '').toLowerCase()
  if (!eventType) throw new Error('eventType is required')
  return updateDb(db => {
    const profile = syncRecommendationProfileInDb(db, userId)
    const event = appendPlatformEventInDb(db, { ...body, userId, actorId: userId, eventType })
    if (profile) updateBehaviorSignals(profile, event)
    appendEdge(db, userId, event)
    recordActivityInDb(db, userId, eventType, body.surface, body.occurredAt)
    return event
  })
}

export function recordExposure(userId, recommendationId, body = {}) {
  return updateDb(db => {
    const recommendation = rows(db, 'recommendations').find(item => item.id === recommendationId && item.userId === userId)
    if (!recommendation) return null
    const exposure = {
      id: createId('rec_exposure'),
      userId,
      recommendationId,
      entityType: recommendation.entityType,
      entityId: recommendation.entityId,
      surface: body.surface || recommendation.surface,
      exposureType: body.exposureType || 'impression',
      createdAt: nowIso(),
    }
    rows(db, 'recommendationExposures').push(exposure)
    const action = String(exposure.exposureType || 'impression').toLowerCase()
    const analyticsEvent = {
      impression: 'recommendation_impression',
      click: 'recommendation_clicked',
      view: 'recommendation_clicked',
      connect: 'recommendation_connected',
      follow: 'recommendation_followed',
      message: 'recommendation_messaged',
      apply: 'recommendation_applied',
      join: 'recommendation_joined',
      invest: 'recommendation_invested',
      save: 'recommendation_saved',
      explore: 'recommendation_clicked',
      introduction: 'recommendation_clicked',
      partner: 'recommendation_clicked',
    }[action] || `recommendation_${action}`
    const event = appendPlatformEventInDb(db, { userId, actorId: userId, eventType: analyticsEvent, entityType: recommendation.entityType, entityId: recommendation.entityId, surface: exposure.surface, importance: 'LOW', metadata: { recommendationId } })
    const behaviorType = {
      recommendation_clicked: 'click', recommendation_connected: 'connect', recommendation_followed: 'follow', recommendation_messaged: 'message', recommendation_applied: 'apply', recommendation_joined: 'join', recommendation_invested: 'invest', recommendation_saved: 'save',
    }[analyticsEvent]
    if (behaviorType) {
      const profile = syncRecommendationProfileInDb(db, userId)
      updateBehaviorSignals(profile, { ...event, eventType: behaviorType, metadata: { tags: candidateTags(recommendation.entity), skills: recommendation.entity.skills || [] } })
      appendEdge(db, userId, { ...event, eventType: behaviorType })
    }
    recordActivityInDb(db, userId, 'recommendation_exposure', exposure.surface)
    return exposure
  })
}

export function recordFeedback(userId, recommendationId, body = {}) {
  const type = String(body.type || '').toLowerCase()
  if (!FEEDBACK_TYPES.has(type)) throw new Error('Unsupported feedback type')
  return updateDb(db => {
    const recommendation = rows(db, 'recommendations').find(item => item.id === recommendationId && item.userId === userId)
    if (!recommendation) return null
    if (type === 'undo') {
      const previous = rows(db, 'recommendationFeedback').filter(item => item.userId === userId && item.recommendationId === recommendationId && !item.undoneAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      if (previous) previous.undoneAt = nowIso()
      return { undone: Boolean(previous) }
    }
    const feedback = {
      id: createId('rec_feedback'),
      userId,
      recommendationId,
      entityType: recommendation.entityType,
      entityId: recommendation.entityId,
      type,
      metadata: body.metadata || {},
      createdAt: nowIso(),
    }
    rows(db, 'recommendationFeedback').push(feedback)
    if (type === 'dont_recommend_type') {
      const preferences = rows(db, 'recommendationPreferences')
      let preference = preferences.find(item => item.userId === userId)
      if (!preference) {
        preference = { id: createId('rec_pref'), userId, mutedTypes: [], createdAt: nowIso() }
        preferences.push(preference)
      }
      preference.mutedTypes = [...new Set([...(preference.mutedTypes || []), recommendation.entityType])]
      preference.updatedAt = nowIso()
    }
    const analyticsEvent = { hide: 'recommendation_hidden', not_interested: 'recommendation_dismissed', dismiss: 'recommendation_dismissed', report: 'recommendation_reported' }[type] || `recommendation_${type}`
    appendPlatformEventInDb(db, { userId, actorId: userId, eventType: analyticsEvent, entityType: recommendation.entityType, entityId: recommendation.entityId, surface: recommendation.surface, importance: type === 'report' ? 'HIGH' : 'LOW', metadata: { recommendationId } })
    return feedback
  })
}

function activityField(eventType, surface) {
  if (eventType === 'login') return 'lastLoginAt'
  if (eventType === 'session') return 'lastSessionAt'
  if (eventType === 'feed_interaction') return 'lastFeedInteractionAt'
  if (eventType === 'recommendation_exposure') return 'lastRecommendationExposureAt'
  if (eventType === 'notification_read') return 'lastNotificationReadAt'
  if (eventType === 'startup_view') return 'lastStartupViewedAt'
  if (eventType === 'project_view') return 'lastProjectViewedAt'
  if (eventType === 'profile_view') return 'lastProfileViewedAt'
  if (eventType === 'search') return 'lastSearchAt'
  if (eventType === 'workspace_activity') return 'lastWorkspaceActivityAt'
  if (eventType === 'feed_visit' || surface === 'feed') return 'lastFeedVisitAt'
  return null
}

function isMeaningful(eventType) {
  return ['click', 'like', 'save', 'share', 'comment', 'follow', 'connect', 'message', 'apply', 'join', 'invest', 'successful_collaboration', 'feed_interaction', 'workspace_activity'].includes(eventType)
}

export function recordActivityInDb(db, userId, eventType, surface, occurredAt) {
  const states = rows(db, 'userActivityStates')
  let state = states.find(item => item.userId === userId)
  if (!state) {
    state = { id: createId('activity'), userId, createdAt: nowIso(), updatedAt: nowIso() }
    states.push(state)
  }
  const now = occurredAt || nowIso()
  if (eventType === 'login') {
    const persistedProfile = rows(db, 'profiles').find(profile => profile.id === userId)
    const anchor = state.lastMeaningfulAt || state.lastSessionAt || state.lastLoginAt || persistedProfile?.lastActiveAt || persistedProfile?.updatedAt || persistedProfile?.createdAt
    if (anchor && Date.now() - new Date(anchor).getTime() >= 24 * HOUR_MS && !state.returnAnchorAt) {
      state.returnAnchorAt = anchor
      state.returnDetectedAt = now
    }
    state.previousLoginAt = state.lastLoginAt || null
  }
  if (eventType === 'session') state.previousSessionAt = state.lastSessionAt || null
  const field = activityField(eventType, surface)
  if (field) state[field] = now
  if (isMeaningful(eventType)) state.lastMeaningfulAt = now
  state.updatedAt = nowIso()
  return state
}

export function noteUserActivity(userId, eventType, surface) {
  return updateDb(db => recordActivityInDb(db, userId, eventType, surface))
}

function inactivityState(config, hours) {
  return [...config.inactivity].sort((a, b) => a.minHours - b.minHours).filter(item => hours >= item.minHours).at(-1)?.state || 'NORMAL'
}

function returnHeadline(role) {
  return {
    explorer: "Here's what you missed",
    founder: "Here's what changed while you were away",
    collaborator: 'New opportunities match your skills',
    investor: 'Your investment landscape changed',
    organization: 'Your ecosystem has changed',
  }[role] || "Here's what you missed"
}

function categoryFor(type) {
  return { person: 'People', startup: 'Startups', project: 'Projects', opportunity: 'Opportunities', idea: 'Ideas', organization: 'Organizations', content: 'Content', notification: 'Network' }[type] || 'Updates'
}

function eventImportance(candidate, events) {
  const explicit = events.find(event => event.entityId === candidate.entityId && event.entityType === candidate.type)?.importance
  if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(explicit)) return explicit
  if (candidate.importance && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(candidate.importance)) return candidate.importance
  if (candidate.type === 'opportunity') return 'HIGH'
  if (candidate.type === 'content') return 'LOW'
  return 'MEDIUM'
}

function importanceBoost(value) {
  return { LOW: 0, MEDIUM: 0.04, HIGH: 0.1, CRITICAL: 0.2 }[value] || 0
}

function returnItemsInDb(db, userId, anchor, limit) {
  const generated = generateRecommendationsInDb(db, userId, { surface: 'return-intelligence', limit: 50 })
  const events = rows(db, 'recommendationEvents').filter(event => new Date(event.createdAt).getTime() > new Date(anchor).getTime() && event.actorId !== userId)
  const eventKeys = new Set(events.map(event => `${event.entityType}:${event.entityId}`))
  const items = generated.recommendations
    .filter(rec => {
      const timestamp = rec.entity.updatedAt || rec.entity.createdAt
      return new Date(timestamp || 0).getTime() > new Date(anchor).getTime() || eventKeys.has(`${rec.entityType}:${rec.entityId}`)
    })
    .map(rec => {
      const importance = eventImportance(rec.entity, events)
      return { ...rec, importance, score: clamp(rec.score + importanceBoost(importance)), category: categoryFor(rec.entityType) }
    })
  for (const notification of rows(db, 'notifications').filter(item => item.userId === userId && new Date(item.createdAt).getTime() > new Date(anchor).getTime())) {
    items.push({
      id: stableId(userId, 'return-intelligence', 'notification', notification.id),
      userId,
      surface: 'return-intelligence',
      entityType: 'notification',
      entityId: notification.id,
      score: notification.type === 'collab' ? 1 : 0.8,
      importance: notification.type === 'collab' ? 'CRITICAL' : 'HIGH',
      category: 'Network',
      reasonType: 'NETWORK_PROXIMITY',
      reasonText: 'This directly affects your TechIT network.',
      entity: {
        entityId: notification.id,
        type: 'notification',
        title: notification.author || 'TechIT update',
        subtitle: notification.content || '',
        description: notification.content || '',
        createdAt: notification.createdAt,
        updatedAt: notification.createdAt,
        url: notification.linkTo || '/feed/notifications',
        actions: [{ id: 'view', label: 'View', href: notification.linkTo || '/feed/notifications' }],
      },
    })
  }
  const catchUp = rows(db, 'catchUpStates').find(item => item.userId === userId && item.anchor === anchor)
  const seen = new Set(catchUp?.seenIds || [])
  const dismissed = new Set(catchUp?.dismissedIds || [])
  const deduped = []
  const keys = new Set()
  for (const item of items.sort((a, b) => b.score - a.score)) {
    const key = `${item.entityType}:${item.entityId}`
    if (keys.has(key) || dismissed.has(item.id)) continue
    keys.add(key)
    deduped.push({ ...item, seen: seen.has(item.id) })
    if (deduped.length >= limit) break
  }
  return deduped
}

export function getReturnSummary(userId) {
  return updateDb(db => {
    const config = getConfigInDb(db)
    const state = rows(db, 'userActivityStates').find(item => item.userId === userId)
    const profile = syncRecommendationProfileInDb(db, userId)
    const anchor = state?.returnAnchorAt
    if (!state || !profile || !anchor) return { available: false, state: 'NORMAL', items: [], categories: [] }
    const hoursAway = Math.max(0, (new Date(state.returnDetectedAt || nowIso()).getTime() - new Date(anchor).getTime()) / HOUR_MS)
    const returnState = inactivityState(config, hoursAway)
    if (returnState === 'NORMAL') return { available: false, state: returnState, items: [], categories: [] }
    const items = returnItemsInDb(db, userId, anchor, config.limits.returnWindow)
    const grouped = new Map()
    for (const item of items) grouped.set(item.category, (grouped.get(item.category) || 0) + 1)
    let catchUp = rows(db, 'catchUpStates').find(item => item.userId === userId && item.anchor === anchor)
    if (!catchUp) {
      catchUp = { id: createId('catchup'), userId, anchor, seenIds: [], dismissedIds: [], startedAt: null, completedAt: null, createdAt: nowIso(), updatedAt: nowIso() }
      rows(db, 'catchUpStates').push(catchUp)
    }
    const alreadyTracked = rows(db, 'recommendationEvents').some(event => event.userId === userId && event.eventType === 'return_summary_shown' && event.metadata?.anchor === anchor)
    if (!alreadyTracked) appendPlatformEventInDb(db, { userId, actorId: userId, eventType: 'return_summary_shown', surface: 'return-intelligence', importance: 'LOW', metadata: { state: returnState, itemCount: items.length, anchor } })
    return {
      available: items.length > 0 && !catchUp.completedAt,
      state: returnState,
      headline: returnHeadline(profile.role),
      message: `${items.length} relevant ${items.length === 1 ? 'update' : 'updates'} happened while you were away.`,
      anchor,
      hoursAway: Math.round(hoursAway),
      categories: [...grouped.entries()].map(([name, count]) => ({ name, count })),
      items,
      completed: Boolean(catchUp.completedAt),
    }
  })
}

export function markCatchUpItem(userId, recommendationId, action = 'seen') {
  return updateDb(db => {
    const state = rows(db, 'userActivityStates').find(item => item.userId === userId)
    if (!state?.returnAnchorAt) return null
    const catchUp = rows(db, 'catchUpStates').find(item => item.userId === userId && item.anchor === state.returnAnchorAt)
    if (!catchUp) return null
    const field = action === 'dismissed' ? 'dismissedIds' : 'seenIds'
    catchUp[field] = [...new Set([...(catchUp[field] || []), recommendationId])]
    catchUp.startedAt ||= nowIso()
    catchUp.updatedAt = nowIso()
    appendPlatformEventInDb(db, { userId, actorId: userId, eventType: action === 'dismissed' ? 'catchup_item_dismissed' : 'catchup_item_viewed', surface: 'return-intelligence', importance: 'LOW', metadata: { recommendationId } })
    return catchUp
  })
}

export function completeCatchUp(userId) {
  return updateDb(db => {
    const state = rows(db, 'userActivityStates').find(item => item.userId === userId)
    if (!state?.returnAnchorAt) return null
    const anchor = state.returnAnchorAt
    let catchUp = rows(db, 'catchUpStates').find(item => item.userId === userId && item.anchor === anchor)
    if (!catchUp) {
      catchUp = { id: createId('catchup'), userId, anchor, seenIds: [], dismissedIds: [], createdAt: nowIso() }
      rows(db, 'catchUpStates').push(catchUp)
    }
    catchUp.completedAt = nowIso()
    catchUp.updatedAt = nowIso()
    state.lastMeaningfulAt = catchUp.completedAt
    state.returnAnchorAt = null
    state.returnDetectedAt = null
    state.updatedAt = nowIso()
    appendPlatformEventInDb(db, { userId, actorId: userId, eventType: 'catchup_completed', surface: 'return-intelligence', importance: 'LOW', metadata: { anchor } })
    return { completed: true, completedAt: catchUp.completedAt }
  })
}

export function getDiscoveryConfig() {
  return getConfigInDb(readDb())
}

export function updateDiscoveryConfig(patch) {
  return updateDb(db => {
    const configs = rows(db, 'recommendationConfigs')
    let config = configs.find(item => item.id === 'default')
    const value = deepMerge(getConfigInDb(db), patch || {})
    if (!config) {
      config = { id: 'default', value, createdAt: nowIso(), updatedAt: nowIso() }
      configs.push(config)
    } else {
      config.value = value
      config.updatedAt = nowIso()
    }
    return value
  })
}

export function getDiscoveryAnalytics() {
  const db = readDb()
  const events = rows(db, 'recommendationEvents')
  const exposures = rows(db, 'recommendationExposures')
  const feedback = rows(db, 'recommendationFeedback').filter(item => !item.undoneAt)
  const count = eventType => events.filter(event => event.eventType === eventType).length
  const impressions = exposures.filter(item => item.exposureType === 'impression').length
  const clicks = count('recommendation_clicked')
  const meaningful = ['recommendation_connected', 'recommendation_applied', 'recommendation_joined', 'recommendation_invested', 'successful_collaboration'].reduce((sum, type) => sum + count(type), 0)
  const byRole = {}
  for (const recommendation of rows(db, 'recommendations')) {
    const role = normalizeRole(rows(db, 'profiles').find(profile => profile.id === recommendation.userId)?.role)
    byRole[role] ||= { generated: 0, averageScore: 0, scoreTotal: 0 }
    byRole[role].generated += 1
    byRole[role].scoreTotal += Number(recommendation.score || 0)
  }
  for (const value of Object.values(byRole)) {
    value.averageScore = value.generated ? Math.round((value.scoreTotal / value.generated) * 1000) / 1000 : 0
    delete value.scoreTotal
  }
  return {
    generated: rows(db, 'recommendations').length,
    impressions,
    clicks,
    ctr: impressions ? Math.round((clicks / impressions) * 10_000) / 100 : 0,
    meaningfulOutcomes: meaningful,
    acceptanceRate: impressions ? Math.round((meaningful / impressions) * 10_000) / 100 : 0,
    rejectionRate: impressions ? Math.round((feedback.length / impressions) * 10_000) / 100 : 0,
    catchUpCompleted: count('catchup_completed'),
    byRole,
  }
}
