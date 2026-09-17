import crypto from 'node:crypto'
import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'

const VISIBILITIES = new Set(['PRIVATE', 'WORKSPACE_ONLY', 'TEAM_ONLY', 'ORGANIZATION_ONLY', 'INVITED_ONLY', 'PUBLIC'])
const SOURCES = new Set(['moment', 'idea_scorecard', 'gsis_milestone', 'validation_result', 'mvp_readiness', 'achievement', 'cohort_outcome', 'investor_readiness', 'workspace_invitation', 'mentor_invitation', 'organization_invitation'])
const EVENTS = new Set(['distribution_created', 'share_created', 'share_clicked', 'external_visit', 'signup_completed', 'referral_activated', 'referral_converted', 'referral_retained', 'invitation_sent', 'invitation_accepted'])
const clean = (value, max) => String(value ?? '').trim().slice(0, max)
const rows = (db, name) => Array.isArray(db[name]) ? db[name] : (db[name] = [])
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex')
const publicObject = object => ({ id: object.id, sourceType: object.sourceType, sourceId: object.sourceId, title: object.title, description: object.description, preview: object.preview, cta: object.cta, destinationRoute: object.destinationRoute, visibility: object.visibility, expiresAt: object.expiresAt, attributionId: object.attributionId, campaignId: object.campaignId, createdAt: object.createdAt, metadata: object.metadata })
function event(db, type, payload = {}) { if (!EVENTS.has(type)) return null; const row = { id: createId('growth_event'), type, createdAt: nowIso(), ...payload }; rows(db, 'growthEvents').push(row); return row }
function sourceOwner(db, sourceType, sourceId) {
  if (!sourceId) return null
  const candidates = [...rows(db, 'techitMoments'), ...rows(db, 'achievements'), ...rows(db, 'projectMilestones'), ...rows(db, 'validationSessions'), ...rows(db, 'investorReadiness')]
  const source = candidates.find(row => row.id === sourceId)
  return source?.userId || source?.ownerId || source?.createdBy || source?.founderId || null
}

export function createDistributionObject(userId, input = {}) {
  const sourceType = clean(input.sourceType || input.source_type, 60).toLowerCase()
  const visibility = clean(input.visibility, 30).toUpperCase() || 'PRIVATE'
  if (!SOURCES.has(sourceType)) return { ok: false, status: 400, error: 'distribution_source_invalid' }
  if (!VISIBILITIES.has(visibility)) return { ok: false, status: 400, error: 'distribution_visibility_invalid' }
  const owner = sourceOwner(readDb(), sourceType, input.sourceId || input.source_id)
  if (owner && owner !== userId) return { ok: false, status: 403, error: 'distribution_source_forbidden' }
  if (visibility === 'PUBLIC' && !owner && !input.publicApproved) return { ok: false, status: 403, error: 'public_distribution_approval_required' }
  const createdAt = nowIso()
  const object = {
    id: createId('distribution'), sourceType, sourceId: clean(input.sourceId || input.source_id, 160) || null, creatorId: userId,
    organizationId: clean(input.organizationId || input.organization_id, 160) || null, workspaceId: clean(input.workspaceId || input.workspace_id, 160) || null,
    title: clean(input.title, 180), description: clean(input.description, 600), preview: clean(input.preview, 1200), shareableContent: clean(input.shareableContent || input.shareable_content || input.description, 2000),
    cta: clean(input.cta, 120) || 'Explore TechIT Network', destinationRoute: clean(input.destinationRoute || input.destination_route, 240) || '/', visibility,
    expiresAt: input.expiresAt || input.expires_at || null, attributionId: createId('attribution'), campaignId: clean(input.campaignId || input.campaign_id, 120) || null,
    createdAt, metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {}, status: 'active', shareCount: 0, clickCount: 0,
  }
  return updateDb(db => { rows(db, 'distributionObjects').push(object); event(db, 'distribution_created', { actorId: userId, distributionObjectId: object.id, sourceType }); return { ok: true, object: publicObject(object) } })
}

export function getDistributionObject(id, actorId = null) {
  const object = rows(readDb(), 'distributionObjects').find(row => row.id === id)
  if (!object || (object.expiresAt && Date.parse(object.expiresAt) <= Date.now())) return { ok: false, status: 404, error: 'distribution_not_found' }
  if (object.visibility !== 'PUBLIC' && object.creatorId !== actorId) return { ok: false, status: 403, error: 'distribution_private' }
  return { ok: true, object: publicObject(object) }
}

export function recordDistributionShare(userId, id, channel = 'copy') {
  return updateDb(db => {
    const object = rows(db, 'distributionObjects').find(row => row.id === id && row.creatorId === userId)
    if (!object || object.visibility === 'PRIVATE') return { ok: false, status: 404, error: 'distribution_not_shareable' }
    const share = { id: createId('share'), distributionObjectId: id, userId, channel: clean(channel, 30) || 'copy', createdAt: nowIso() }
    rows(db, 'distributionShares').push(share); object.shareCount = Number(object.shareCount || 0) + 1; event(db, 'share_created', { actorId: userId, distributionObjectId: id, shareId: share.id, channel: share.channel })
    return { ok: true, shareId: share.id, attributionId: object.attributionId, object: publicObject(object) }
  })
}

export function recordDistributionClick(id, input = {}) {
  return updateDb(db => {
    const object = rows(db, 'distributionObjects').find(row => row.id === id && row.visibility === 'PUBLIC')
    if (!object || (object.expiresAt && Date.parse(object.expiresAt) <= Date.now())) return { ok: false, status: 404, error: 'distribution_not_found' }
    const attribution = { id: createId('referral'), attributionId: object.attributionId, distributionObjectId: id, source: clean(input.source || input.channel, 60) || 'direct', campaignId: object.campaignId, firstTouch: nowIso(), lastTouch: nowIso(), status: 'visited', visitorHash: input.visitorId ? hash(input.visitorId) : null }
    rows(db, 'distributionAttributions').push(attribution); object.clickCount = Number(object.clickCount || 0) + 1; event(db, 'share_clicked', { distributionObjectId: id, attributionId: attribution.id, source: attribution.source }); event(db, 'external_visit', { distributionObjectId: id, attributionId: attribution.id, source: attribution.source })
    return { ok: true, referralId: attribution.id, attributionId: object.attributionId, destinationRoute: object.destinationRoute }
  })
}

export function activateDistributionReferral(userId, referralId, input = {}) {
  return updateDb(db => {
    const attribution = rows(db, 'distributionAttributions').find(row => row.id === referralId)
    if (!attribution) return { ok: false, status: 404, error: 'referral_not_found' }
    if (attribution.signupUserId && attribution.signupUserId !== userId) return { ok: false, status: 409, error: 'referral_already_attributed' }
    attribution.signupUserId = userId; attribution.signupAt = attribution.signupAt || nowIso(); attribution.lastTouch = nowIso(); attribution.status = 'signed_up'; attribution.activationAction = clean(input.activationAction || input.activation_action, 120) || null
    event(db, 'signup_completed', { actorId: userId, attributionId: attribution.id, distributionObjectId: attribution.distributionObjectId });
    if (attribution.activationAction) { attribution.activatedAt = nowIso(); attribution.status = 'activated'; event(db, 'referral_activated', { actorId: userId, attributionId: attribution.id, distributionObjectId: attribution.distributionObjectId, action: attribution.activationAction }) }
    return { ok: true, referralId: attribution.id, status: attribution.status }
  })
}

export function distributionMetrics() {
  const db = readDb(); const objects = rows(db, 'distributionObjects'); const shares = rows(db, 'distributionShares'); const attrs = rows(db, 'distributionAttributions'); const events = rows(db, 'growthEvents')
  const activated = attrs.filter(row => row.activatedAt).length; const inviters = new Set(shares.map(row => row.userId)).size
  return { ok: true, metrics: { objects: objects.length, publicObjects: objects.filter(row => row.visibility === 'PUBLIC').length, shares: shares.length, visits: attrs.length, signups: attrs.filter(row => row.signupUserId).length, activated, converted: attrs.filter(row => row.convertedAt).length, shareRate: objects.length ? shares.length / objects.length : 0, activationRate: attrs.length ? activated / attrs.length : 0, viralCoefficient: inviters ? activated / inviters : 0, organicAcquisitionRate: attrs.length ? attrs.filter(row => row.source === 'direct').length / attrs.length : 0 }, events: events.slice(-100) }
}
