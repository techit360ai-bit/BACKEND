import crypto from 'node:crypto'
import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import {
  distributionStoreEnabled,
  findDistributionSourceOwner,
  insertDistributionObject,
  loadDistributionObject,
  saveDistributionObject,
  insertDistributionShare,
  insertDistributionAttribution,
  loadDistributionAttribution,
  updateDistributionAttribution,
  distributionAggregates,
} from '../repositories/distributionRepository.js'

const VISIBILITIES = new Set(['PRIVATE', 'WORKSPACE_ONLY', 'TEAM_ONLY', 'ORGANIZATION_ONLY', 'INVITED_ONLY', 'PUBLIC'])
const SOURCES = new Set(['moment', 'idea_scorecard', 'gsis_milestone', 'validation_result', 'mvp_readiness', 'achievement', 'cohort_outcome', 'investor_readiness', 'workspace_invitation', 'mentor_invitation', 'organization_invitation'])
const EVENTS = new Set(['distribution_created', 'share_created', 'share_clicked', 'external_visit', 'signup_completed', 'referral_activated', 'referral_converted', 'referral_retained', 'invitation_sent', 'invitation_accepted'])
const clean = (value, max) => String(value ?? '').trim().slice(0, max)
const rows = (db, name) => Array.isArray(db[name]) ? db[name] : (db[name] = [])
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex')
const publicObject = object => ({ id: object.id, sourceType: object.sourceType, sourceId: object.sourceId, title: object.title, description: object.description, preview: object.preview, cta: object.cta, destinationRoute: object.destinationRoute, visibility: object.visibility, expiresAt: object.expiresAt, attributionId: object.attributionId, campaignId: object.campaignId, createdAt: object.createdAt, metadata: object.metadata })

// A growth event is a pure row; the store path persists it via the repository,
// the sqlite path pushes it onto the snapshot collection.
function eventRow(type, payload = {}) { if (!EVENTS.has(type)) return null; return { id: createId('growth_event'), type, createdAt: nowIso(), ...payload } }
function pushEvent(db, row) { if (row) rows(db, 'growthEvents').push(row) }

// Legacy snapshot source-owner lookup (fallback path only).
function snapshotSourceOwner(db, sourceType, sourceId) {
  if (!sourceId) return null
  const candidates = [...rows(db, 'techitMoments'), ...rows(db, 'achievements'), ...rows(db, 'projectMilestones'), ...rows(db, 'validationSessions'), ...rows(db, 'investorReadiness')]
  const source = candidates.find(row => row.id === sourceId)
  return source?.userId || source?.ownerId || source?.createdBy || source?.founderId || null
}

export async function createDistributionObject(userId, input = {}) {
  const sourceType = clean(input.sourceType || input.source_type, 60).toLowerCase()
  const visibility = clean(input.visibility, 30).toUpperCase() || 'PRIVATE'
  if (!SOURCES.has(sourceType)) return { ok: false, status: 400, error: 'distribution_source_invalid' }
  if (!VISIBILITIES.has(visibility)) return { ok: false, status: 400, error: 'distribution_visibility_invalid' }
  const sourceId = clean(input.sourceId || input.source_id, 160) || null
  const owner = distributionStoreEnabled() ? await findDistributionSourceOwner(sourceId) : snapshotSourceOwner(readDb(), sourceType, sourceId)
  if (owner && owner !== userId) return { ok: false, status: 403, error: 'distribution_source_forbidden' }
  if (visibility === 'PUBLIC' && !owner && !input.publicApproved) return { ok: false, status: 403, error: 'public_distribution_approval_required' }
  const createdAt = nowIso()
  const object = {
    id: createId('distribution'), sourceType, sourceId, creatorId: userId,
    organizationId: clean(input.organizationId || input.organization_id, 160) || null, workspaceId: clean(input.workspaceId || input.workspace_id, 160) || null,
    title: clean(input.title, 180), description: clean(input.description, 600), preview: clean(input.preview, 1200), shareableContent: clean(input.shareableContent || input.shareable_content || input.description, 2000),
    cta: clean(input.cta, 120) || 'Explore TechIT Network', destinationRoute: clean(input.destinationRoute || input.destination_route, 240) || '/', visibility,
    expiresAt: input.expiresAt || input.expires_at || null, attributionId: createId('attribution'), campaignId: clean(input.campaignId || input.campaign_id, 120) || null,
    createdAt, metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {}, status: 'active', shareCount: 0, clickCount: 0,
  }
  const created = eventRow('distribution_created', { actorId: userId, distributionObjectId: object.id, sourceType })
  if (distributionStoreEnabled()) {
    await insertDistributionObject(object, [created])
    return { ok: true, object: publicObject(object) }
  }
  return updateDb(db => { rows(db, 'distributionObjects').push(object); pushEvent(db, created); return { ok: true, object: publicObject(object) } })
}

export async function getDistributionObject(id, actorId = null) {
  const object = distributionStoreEnabled() ? await loadDistributionObject(id) : rows(readDb(), 'distributionObjects').find(row => row.id === id)
  if (!object || (object.expiresAt && Date.parse(object.expiresAt) <= Date.now())) return { ok: false, status: 404, error: 'distribution_not_found' }
  if (object.visibility !== 'PUBLIC' && object.creatorId !== actorId) return { ok: false, status: 403, error: 'distribution_private' }
  return { ok: true, object: publicObject(object) }
}

export async function recordDistributionShare(userId, id, channel = 'copy') {
  if (distributionStoreEnabled()) {
    const object = await loadDistributionObject(id)
    if (!object || object.creatorId !== userId || object.visibility === 'PRIVATE') return { ok: false, status: 404, error: 'distribution_not_shareable' }
    const share = { id: createId('share'), distributionObjectId: id, userId, channel: clean(channel, 30) || 'copy', createdAt: nowIso() }
    const created = eventRow('share_created', { actorId: userId, distributionObjectId: id, shareId: share.id, channel: share.channel })
    const updated = { ...object, shareCount: Number(object.shareCount || 0) + 1, updatedAt: share.createdAt }
    await insertDistributionShare(share, [created])
    await saveDistributionObject(updated)
    return { ok: true, shareId: share.id, attributionId: object.attributionId, object: publicObject(updated) }
  }
  return updateDb(db => {
    const object = rows(db, 'distributionObjects').find(row => row.id === id && row.creatorId === userId)
    if (!object || object.visibility === 'PRIVATE') return { ok: false, status: 404, error: 'distribution_not_shareable' }
    const share = { id: createId('share'), distributionObjectId: id, userId, channel: clean(channel, 30) || 'copy', createdAt: nowIso() }
    rows(db, 'distributionShares').push(share); object.shareCount = Number(object.shareCount || 0) + 1; pushEvent(db, eventRow('share_created', { actorId: userId, distributionObjectId: id, shareId: share.id, channel: share.channel }))
    return { ok: true, shareId: share.id, attributionId: object.attributionId, object: publicObject(object) }
  })
}

export async function recordDistributionClick(id, input = {}) {
  const buildAttribution = object => ({ id: createId('referral'), attributionId: object.attributionId, distributionObjectId: id, source: clean(input.source || input.channel, 60) || 'direct', campaignId: object.campaignId, firstTouch: nowIso(), lastTouch: nowIso(), status: 'visited', visitorHash: input.visitorId ? hash(input.visitorId) : null })
  if (distributionStoreEnabled()) {
    const object = await loadDistributionObject(id)
    if (!object || object.visibility !== 'PUBLIC' || (object.expiresAt && Date.parse(object.expiresAt) <= Date.now())) return { ok: false, status: 404, error: 'distribution_not_found' }
    const attribution = buildAttribution(object)
    const events = [eventRow('share_clicked', { distributionObjectId: id, attributionId: attribution.id, source: attribution.source }), eventRow('external_visit', { distributionObjectId: id, attributionId: attribution.id, source: attribution.source })]
    const updated = { ...object, clickCount: Number(object.clickCount || 0) + 1, updatedAt: nowIso() }
    await insertDistributionAttribution(attribution, events)
    await saveDistributionObject(updated)
    return { ok: true, referralId: attribution.id, attributionId: object.attributionId, destinationRoute: object.destinationRoute }
  }
  return updateDb(db => {
    const object = rows(db, 'distributionObjects').find(row => row.id === id && row.visibility === 'PUBLIC')
    if (!object || (object.expiresAt && Date.parse(object.expiresAt) <= Date.now())) return { ok: false, status: 404, error: 'distribution_not_found' }
    const attribution = buildAttribution(object)
    rows(db, 'distributionAttributions').push(attribution); object.clickCount = Number(object.clickCount || 0) + 1
    pushEvent(db, eventRow('share_clicked', { distributionObjectId: id, attributionId: attribution.id, source: attribution.source })); pushEvent(db, eventRow('external_visit', { distributionObjectId: id, attributionId: attribution.id, source: attribution.source }))
    return { ok: true, referralId: attribution.id, attributionId: object.attributionId, destinationRoute: object.destinationRoute }
  })
}

export async function activateDistributionReferral(userId, referralId, input = {}) {
  // Mutates the attribution in place and returns the events to persist.
  const applyActivation = attribution => {
    attribution.signupUserId = userId; attribution.signupAt = attribution.signupAt || nowIso(); attribution.lastTouch = nowIso(); attribution.status = 'signed_up'; attribution.activationAction = clean(input.activationAction || input.activation_action, 120) || null
    const events = [eventRow('signup_completed', { actorId: userId, attributionId: attribution.id, distributionObjectId: attribution.distributionObjectId })]
    if (attribution.activationAction) { attribution.activatedAt = nowIso(); attribution.status = 'activated'; events.push(eventRow('referral_activated', { actorId: userId, attributionId: attribution.id, distributionObjectId: attribution.distributionObjectId, action: attribution.activationAction })) }
    return events
  }
  if (distributionStoreEnabled()) {
    const attribution = await loadDistributionAttribution(referralId)
    if (!attribution) return { ok: false, status: 404, error: 'referral_not_found' }
    if (attribution.signupUserId && attribution.signupUserId !== userId) return { ok: false, status: 409, error: 'referral_already_attributed' }
    const events = applyActivation(attribution)
    await updateDistributionAttribution(attribution, events)
    return { ok: true, referralId: attribution.id, status: attribution.status }
  }
  return updateDb(db => {
    const attribution = rows(db, 'distributionAttributions').find(row => row.id === referralId)
    if (!attribution) return { ok: false, status: 404, error: 'referral_not_found' }
    if (attribution.signupUserId && attribution.signupUserId !== userId) return { ok: false, status: 409, error: 'referral_already_attributed' }
    for (const event of applyActivation(attribution)) pushEvent(db, event)
    return { ok: true, referralId: attribution.id, status: attribution.status }
  })
}

export async function distributionMetrics() {
  if (distributionStoreEnabled()) {
    const a = await distributionAggregates()
    return {
      ok: true,
      metrics: {
        objects: a.objects, publicObjects: a.publicObjects, shares: a.shares, visits: a.visits, signups: a.signups, activated: a.activated, converted: a.converted,
        shareRate: a.objects ? a.shares / a.objects : 0,
        activationRate: a.visits ? a.activated / a.visits : 0,
        viralCoefficient: a.inviters ? a.activated / a.inviters : 0,
        organicAcquisitionRate: a.visits ? a.directVisits / a.visits : 0,
      },
      events: (a.events || []).slice(-100),
    }
  }
  const db = readDb(); const objects = rows(db, 'distributionObjects'); const shares = rows(db, 'distributionShares'); const attrs = rows(db, 'distributionAttributions'); const events = rows(db, 'growthEvents')
  const activated = attrs.filter(row => row.activatedAt).length; const inviters = new Set(shares.map(row => row.userId)).size
  return { ok: true, metrics: { objects: objects.length, publicObjects: objects.filter(row => row.visibility === 'PUBLIC').length, shares: shares.length, visits: attrs.length, signups: attrs.filter(row => row.signupUserId).length, activated, converted: attrs.filter(row => row.convertedAt).length, shareRate: objects.length ? shares.length / objects.length : 0, activationRate: attrs.length ? activated / attrs.length : 0, viralCoefficient: inviters ? activated / inviters : 0, organicAcquisitionRate: attrs.length ? attrs.filter(row => row.source === 'direct').length / attrs.length : 0 }, events: events.slice(-100) }
}
