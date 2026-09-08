import { randomBytes } from 'node:crypto'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { createId, nowIso, userName } from '../utils/api.js'
import { createDistributionObject } from './distributionIntelligenceService.js'

const SHARE_CHANNELS = new Set(['copy', 'native', 'linkedin', 'x', 'whatsapp', 'instagram', 'telegram', 'facebook'])
const ROLE_ALIASES = { organization: 'organisation', org: 'organisation' }

function rows(db, name) { return Array.isArray(db[name]) ? db[name] : [] }
function normalizeRole(role) { return ROLE_ALIASES[String(role || '').toLowerCase()] || String(role || 'explorer').toLowerCase() }
function completed(row) { return ['completed', 'complete', 'done', 'shipped', 'resolved', 'closed'].includes(String(row?.status || '').toLowerCase()) }
function publicBaseUrl() { return String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '') }
function publicUrl(slug) { return `${publicBaseUrl()}/moments/${encodeURIComponent(slug)}` }
function safeMetric(key, label, value, source) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? { key, label, value: numeric, source } : null
}
function metricCount(key, label, source, value) { return safeMetric(key, label, value, source) }

function founderCandidates(db, userId) {
  const projects = rows(db, 'projects').filter(row => row.ownerId === userId || row.userId === userId || row.founderId === userId)
  const intakes = rows(db, 'ventureIntakes').filter(row => row.ownerId === userId || row.userId === userId || row.founderId === userId)
  const analyses = rows(db, 'ventureAnalyses').filter(row => row.ownerId === userId || row.userId === userId || row.founderId === userId || intakes.some(i => i.id === row.intakeId))
  const pivots = rows(db, 'pivotRecords').filter(row => row.userId === userId || row.ownerId === userId || projects.some(p => p.id === row.projectId))
  const projectMetric = metricCount('projects', 'Projects', 'projects', projects.length)
  const intakeMetric = metricCount('ideas_captured', 'Ideas captured', 'ventureIntakes', intakes.length)
  const analysisMetric = metricCount('assumptions_tested', 'Assumptions tested', 'ventureAnalyses', analyses.length)
  const pivotMetric = metricCount('pivots', 'Pivots', 'pivotRecords', pivots.length)
  const completedMilestones = projects.filter(project => project.mvpReady === true || completed(project) || ['mvp', 'beta', 'launch', 'launched', 'growth'].includes(String(project.stage || '').toLowerCase()))
  const milestoneMetric = metricCount('milestones', 'Milestones', 'projects', completedMilestones.length)
  const validated = analyses.filter(row => ['validated', 'complete', 'completed', 'approved'].includes(String(row.status || row.verdict || '').toLowerCase()))
  const validationMetric = metricCount('validated_assumptions', 'Validated assumptions', 'ventureAnalyses', validated.length)
  const out = []
  if (projectMetric) out.push({ kind: 'project_started', scopeKey: `projects:${projects.map(p => p.id).sort().join(',')}`, title: 'A new chapter is underway', subtitle: 'You started building on TechIT Network.', body: 'Your progress is now part of the TechIT Network story.', metrics: [projectMetric] })
  if (intakeMetric) out.push({ kind: 'idea_captured', scopeKey: `intakes:${intakes.map(i => i.id).sort().join(',')}`, title: 'You gave an idea a place to grow', subtitle: 'No idea should be lost.', body: 'TechIT recorded your venture intake and preserved the starting assumption.', metrics: [intakeMetric, projectMetric].filter(Boolean) })
  if (analysisMetric) out.push({ kind: 'assumptions_tested', scopeKey: `analyses:${analyses.map(a => a.id).sort().join(',')}`, title: 'You turned an assumption into evidence', subtitle: 'Real progress starts with a question worth testing.', body: 'TechIT recorded analysis tied to your persisted venture work.', metrics: [analysisMetric, validationMetric].filter(Boolean) })
  if (validationMetric) out.push({ kind: 'idea_validated', scopeKey: `validated:${validated.map(a => a.id).sort().join(',')}`, title: 'You validated a venture assumption', subtitle: 'Evidence is stronger than intuition.', body: 'TechIT recorded a completed validation analysis from your persisted venture work.', metrics: [validationMetric, analysisMetric].filter(Boolean) })
  if (pivotMetric) out.push({ kind: 'pivot_recorded', scopeKey: `pivots:${pivots.map(p => p.id).sort().join(',')}`, title: 'You made a sharper decision', subtitle: 'Learning changed the direction of the build.', body: 'A pivot was recorded in your venture history. No idea should be lost.', metrics: [pivotMetric] })
  if (milestoneMetric) out.push({ kind: 'mvp_ready', scopeKey: `milestones:${completedMilestones.map(p => p.id).sort().join(',')}`, title: 'A meaningful milestone is complete', subtitle: 'Your venture moved from planning into delivery.', body: 'TechIT recorded a persisted project milestone or stage transition.', metrics: [milestoneMetric, projectMetric].filter(Boolean) })
  return out
}

function collaboratorCandidates(db, userId) {
  const contributions = rows(db, 'contributions').filter(row => row.collaboratorId === userId || row.userId === userId)
  const verified = contributions.filter(row => row.verified === true || row.status === 'verified' || completed(row))
  const tasks = [...rows(db, 'workspaceTasks'), ...rows(db, 'mentorshipTasks')].filter(row => row.assigneeId === userId || row.assignedTo === userId || row.userId === userId || row.ownerId === userId)
  const shipped = tasks.filter(completed).length + verified.reduce((sum, row) => sum + Number(row.milestonesShipped || 0), 0)
  const projectIds = new Set([...verified, ...tasks].map(row => row.projectId || row.workspaceId || row.startupId).filter(Boolean))
  const contributionMetric = metricCount('contributions', 'Contributions', 'contributions', verified.length)
  const shippedMetric = metricCount('tasks_shipped', 'Tasks shipped', 'workspaceTasks', shipped)
  const projectMetric = metricCount('projects', 'Projects contributed to', 'contributions', projectIds.size)
  const out = []
  if (shippedMetric) out.push({ kind: 'task_shipped', scopeKey: `shipped:${shipped}:${tasks.filter(completed).map(t => t.id).sort().join(',')}`, title: 'You shipped meaningful work', subtitle: 'Progress is built by people who follow through.', body: 'TechIT recorded completed work connected to your collaborator activity.', metrics: [shippedMetric, contributionMetric].filter(Boolean) })
  if (projectIds.size >= 2) out.push({ kind: 'cross_workspace_builder', scopeKey: `projects:${[...projectIds].sort().join(',')}`, title: 'You built across workspaces', subtitle: 'Your contribution reached more than one project.', body: 'Your persisted contribution history shows work across multiple projects or workspaces.', metrics: [projectMetric, contributionMetric].filter(Boolean) })
  if (verified.some(row => Number(row.impactScore || row.impact || row.milestonesShipped || 0) >= 3)) out.push({ kind: 'high_impact_contribution', scopeKey: `impact:${verified.map(row => row.id).sort().join(',')}`, title: 'Your contribution made an impact', subtitle: 'Consistent execution creates visible momentum.', body: 'A verified contribution record reached the platform impact threshold.', metrics: [contributionMetric, shippedMetric].filter(Boolean) })
  return out
}

function explorerCandidates(db, userId) {
  const applications = rows(db, 'opportunityApplications').filter(row => row.applicantId === userId || row.userId === userId)
  const projects = rows(db, 'projects').filter(row => row.ownerId === userId || row.userId === userId)
  const posts = rows(db, 'feedPosts').filter(row => row.authorId === userId || row.userId === userId)
  const accepted = applications.filter(row => ['accepted', 'matched', 'selected', 'approved'].includes(String(row.status || '').toLowerCase()))
  const out = []
  const projectMetric = metricCount('projects', 'Projects', 'projects', projects.length)
  const matchMetric = metricCount('matches', 'Matches', 'opportunityApplications', accepted.length)
  const contributionMetric = metricCount('contributions', 'Community contributions', 'feedPosts', posts.length)
  if (projects.length) out.push({ kind: 'first_project', scopeKey: `projects:${projects.map(p => p.id).sort().join(',')}`, title: 'You started building on TechIT', subtitle: 'Exploration became action.', body: 'A persisted project now marks your next chapter on TechIT Network.', metrics: [projectMetric] })
  if (accepted.length) out.push({ kind: 'first_match', scopeKey: `matches:${accepted.map(a => a.id).sort().join(',')}`, title: 'You found a meaningful opportunity', subtitle: 'The right connection can change what happens next.', body: 'TechIT recorded an accepted or matched opportunity in your activity.', metrics: [matchMetric] })
  if (posts.length) out.push({ kind: 'community_contributor', scopeKey: `posts:${posts.map(p => p.id).sort().join(',')}`, title: 'You contributed to the network', subtitle: 'Your perspective added to the TechIT community.', body: 'TechIT recorded public community activity associated with your account.', metrics: [contributionMetric] })
  return out
}

function candidates(db, userId, role) {
  const normalized = normalizeRole(role)
  if (normalized === 'founder') return founderCandidates(db, userId)
  if (normalized === 'collaborator') return collaboratorCandidates(db, userId)
  if (normalized === 'explorer') return explorerCandidates(db, userId)
  if (normalized === 'organisation') {
    const projects = rows(db, 'projects').filter(row => row.organizationId === userId)
    const metric = metricCount('projects', 'Projects supported', 'projects', projects.length)
    return metric ? [{ kind: 'cohort_builder', scopeKey: `projects:${projects.map(p => p.id).sort().join(',')}`, title: 'You are creating room for builders', subtitle: 'Progress compounds when communities invest in execution.', body: 'TechIT recorded projects supported by your organisation.', metrics: [metric] }] : []
  }
  if (normalized === 'investor') {
    const watchlist = rows(db, 'investorWatchlists').filter(row => row.investorId === userId || row.userId === userId)
    const metric = metricCount('startups_followed', 'Startups followed', 'investorWatchlists', watchlist.length)
    return metric ? [{ kind: 'portfolio_builder', scopeKey: `watchlist:${watchlist.map(row => row.id).sort().join(',')}`, title: 'You are backing the next chapter', subtitle: 'Attention and support help good work move forward.', body: 'TechIT recorded your persisted portfolio activity.', metrics: [metric] }] : []
  }
  return []
}

function profileFor(db, userId) { return rows(db, 'profiles').find(row => row.id === userId) || rows(db, 'users').find(row => row.id === userId) || null }
function toPublic(moment) {
  return { id: moment.id, role: moment.role, kind: moment.kind, title: moment.title, subtitle: moment.subtitle, body: moment.body, metrics: moment.metrics, publicSlug: moment.publicSlug, publicUrl: moment.publicUrl, status: moment.status, createdAt: moment.createdAt, generatedAt: moment.generatedAt, shareCount: moment.shareCount || 0 }
}

export function generateMoments(userId, role) {
  const db = readAuthorityDb(); const normalizedRole = normalizeRole(role); const generated = candidates(db, userId, normalizedRole)
  const profile = profileFor(db, userId)
  const result = updateAuthorityDb(state => {
    const collection = rows(state, 'techitMoments'); const output = []
    for (const candidate of generated) {
      const existing = collection.find(row => row.userId === userId && row.role === normalizedRole && row.kind === candidate.kind && row.sourceKey === candidate.scopeKey)
      if (existing) { output.push(existing); continue }
      const slug = `${normalizedRole}-${candidate.kind}-${randomBytes(8).toString('hex')}`
      const createdAt = nowIso()
      const moment = { id: createId('moment'), userId, role: normalizedRole, kind: candidate.kind, title: candidate.title, subtitle: candidate.subtitle, body: candidate.body, metrics: candidate.metrics, sourceKey: candidate.scopeKey, sourceEventIds: [], publicSlug: slug, publicUrl: publicUrl(slug), status: 'pending', shareCount: 0, referralCount: 0, createdAt, updatedAt: createdAt, generatedAt: createdAt, generatedFrom: 'backend_deterministic' }
      collection.push(moment); rows(state, 'techitMomentEvents').push({ id: createId('moment_event'), momentId: moment.id, userId, type: 'moment_generated', metadata: { kind: moment.kind, sourceKey: moment.sourceKey }, createdAt })
      output.push(moment)
    }
    return output
  })
  return { ok: true, moments: result.map(toPublic), generatedFor: { userId, role: normalizedRole }, displayName: profile ? userName(profile, '') : null }
}

export function listMoments(userId, role) {
  generateMoments(userId, role)
  const db = readAuthorityDb(); return { ok: true, moments: rows(db, 'techitMoments').filter(row => row.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(toPublic) }
}

export function nextMomentPrompt(userId, role) {
  generateMoments(userId, role)
  const db = readAuthorityDb()
  const moment = rows(db, 'techitMoments')
    .filter(row => row.userId === userId && row.status === 'pending')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
  return { ok: true, moment: moment ? toPublic(moment) : null }
}

export function dismissMoment(userId, momentId) {
  return updateAuthorityDb(db => {
    const moment = rows(db, 'techitMoments').find(row => row.id === momentId && row.userId === userId)
    if (!moment || moment.status !== 'pending') return { ok: false, status: 404, error: 'moment_not_found' }
    const createdAt = nowIso()
    moment.status = 'dismissed'; moment.dismissedAt = createdAt; moment.updatedAt = createdAt
    rows(db, 'techitMomentEvents').push({ id: createId('moment_event'), momentId, userId, type: 'moment_dismissed', metadata: {}, createdAt })
    return { ok: true }
  })
}

export function getMoment(userId, momentId) {
  const db = readAuthorityDb(); const moment = rows(db, 'techitMoments').find(row => row.id === momentId && row.userId === userId)
  return moment ? { ok: true, moment: toPublic(moment) } : { ok: false, status: 404, error: 'moment_not_found' }
}

function shareUrl(channel, url, text, ref) {
  const target = `${url}?ref=${encodeURIComponent(ref)}`; const u = encodeURIComponent(target); const t = encodeURIComponent(text)
  if (channel === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`
  if (channel === 'x') return `https://twitter.com/intent/tweet?text=${t}&url=${u}`
  if (channel === 'whatsapp') return `https://wa.me/?text=${encodeURIComponent(`${text} ${target}`)}`
  if (channel === 'telegram') return `https://t.me/share/url?url=${u}&text=${t}`
  if (channel === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${u}`
  return null
}

export function recordShare(userId, momentId, channel) {
  if (!SHARE_CHANNELS.has(channel)) return { ok: false, status: 400, error: 'unsupported_share_channel' }
  const result = updateAuthorityDb(db => {
    const moment = rows(db, 'techitMoments').find(row => row.id === momentId && row.userId === userId)
    if (!moment) return { ok: false, status: 404, error: 'moment_not_found' }
    const shareId = createId('moment_share'); const text = `${moment.title} — ${moment.subtitle} Built and shared on TechIT Network.`
    const share = { id: shareId, momentId, userId, channel, createdAt: nowIso() }; rows(db, 'techitMomentShares').push(share); rows(db, 'techitMomentEvents').push({ id: createId('moment_event'), momentId, userId, type: 'moment_shared', metadata: { shareId, channel }, createdAt: share.createdAt }); moment.shareCount = Number(moment.shareCount || 0) + 1; moment.updatedAt = share.createdAt
    moment.status = 'published'; moment.publishedAt = moment.publishedAt || share.createdAt
    return { ok: true, shareId, channel, publicUrl: moment.publicUrl, shareText: text, channelUrl: shareUrl(channel, moment.publicUrl, text, shareId), workflow: channel === 'instagram' ? 'native_share_or_copy' : 'direct_or_copy' }
  })
  if (result?.ok) {
    try {
      const distribution = createDistributionObject(userId, { sourceType: 'moment', sourceId: momentId, visibility: 'PUBLIC', title: result.shareText?.split(' — ')[0] || 'TechIT progress', description: result.shareText || '', preview: result.shareText || '', cta: 'Try your own diagnostic', destinationRoute: '/signup' })
      if (distribution?.ok) result.distributionId = distribution.object.id
    } catch { /* existing Moment sharing remains authoritative if extension is unavailable */ }
  }
  return result
}

export function getPublicMoment(slug) {
  const db = readAuthorityDb(); const moment = rows(db, 'techitMoments').find(row => row.publicSlug === slug && row.status === 'published')
  return moment ? { ok: true, moment: toPublic(moment) } : { ok: false, status: 404, error: 'moment_not_found' }
}

export function recordVisit(slug, referralId, source) {
  return updateAuthorityDb(db => {
    const moment = rows(db, 'techitMoments').find(row => row.publicSlug === slug && row.status === 'published'); if (!moment) return { ok: false, status: 404, error: 'moment_not_found' }
    const share = referralId ? rows(db, 'techitMomentShares').find(row => row.id === referralId && row.momentId === moment.id) : null
    const referral = { id: createId('moment_referral'), momentId: moment.id, shareId: share?.id || null, source: typeof source === 'string' && source.length < 40 ? source : 'direct', createdAt: nowIso() }
    rows(db, 'techitMomentReferrals').push(referral); rows(db, 'techitMomentEvents').push({ id: createId('moment_event'), momentId: moment.id, userId: moment.userId, type: 'moment_visited', metadata: { referralId: referral.id, shareId: referral.shareId, source: referral.source }, createdAt: referral.createdAt }); moment.referralCount = Number(moment.referralCount || 0) + 1
    return { ok: true, referralId: referral.id }
  })
}

export function activateReferral(referralId, userId, action = 'account_created') {
  return updateAuthorityDb(db => {
    const referral = rows(db, 'techitMomentReferrals').find(row => row.id === referralId)
    if (!referral) return { ok: false, status: 404, error: 'referral_not_found' }
    if (referral.signupUserId && referral.signupUserId !== userId) return { ok: false, status: 409, error: 'referral_already_attributed' }
    referral.signupUserId = userId; referral.signupAt = referral.signupAt || nowIso(); referral.activationAction = String(action).slice(0, 120); referral.activatedAt = referral.activatedAt || nowIso(); referral.status = 'activated'
    rows(db, 'techitMomentEvents').push({ id: createId('moment_event'), momentId: referral.momentId, userId, type: 'referral_activated', metadata: { referralId, action: referral.activationAction }, createdAt: nowIso() })
    return { ok: true, referralId, status: referral.status }
  })
}

export function analytics(userId) {
  const db = readAuthorityDb(); const moments = rows(db, 'techitMoments').filter(row => row.userId === userId); const ids = new Set(moments.map(row => row.id)); const shares = rows(db, 'techitMomentShares').filter(row => ids.has(row.momentId)); const referrals = rows(db, 'techitMomentReferrals').filter(row => ids.has(row.momentId)); const activated = referrals.filter(row => row.activatedAt).length
  return { ok: true, totals: { moments: moments.length, shares: shares.length, referrals: referrals.length }, activation: { activated, rate: referrals.length ? activated / referrals.length : 0 }, byChannel: Object.fromEntries([...new Set(shares.map(row => row.channel))].map(channel => [channel, shares.filter(row => row.channel === channel).length])) }
}

export { toPublic }
