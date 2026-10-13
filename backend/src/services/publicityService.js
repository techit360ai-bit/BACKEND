import { updateAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { subscriptionEntitlement } from './capabilityAuthorization.js'

// Subscriber publicity (Phase P).
//
// When a subscriber's venture reaches launch, TechIT gives it free publicity:
// one public feed post announcing the launch to everyone, gated by (a) an active
// subscription and (b) the founder's `publicity` notification preference. The
// TechIT Moment already exists — the launch is a completed-milestone candidate
// the moments engine derives on its own — so this only adds the broadcast, and
// it is idempotent per project. No new broadcast system.

const LAUNCH_STAGES = new Set(['launched', 'growth'])
const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }

function publicBaseUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
}

/**
 * Subscriber publicity defaults ON (opt-out). An explicit `false` disables it.
 * The flag may live in any of the shapes the notification-preferences endpoint
 * accepts: a flat `publicity`, the Settings `founder` scope, or the dedicated
 * `categories` block used by the inline "turn off similar" action.
 */
export function publicityPreferenceEnabled(db, userId) {
  const prefs = rows(db, 'notificationPreferences').find(row => row.userId === userId)?.preferences || {}
  const value = prefs.publicity
    ?? prefs.categories?.publicity
    ?? prefs.founder?.publicity
  return value === undefined ? true : Boolean(value)
}

export function publicizeLaunchInDb(db, userId, projectId, projectArg = null) {
  const project = projectArg || rows(db, 'projects').find(row => row.id === projectId)
  if (!project) return { ok: false, error: 'project_not_found' }
  if (!LAUNCH_STAGES.has(String(project.stage || '').toLowerCase())) return { ok: false, error: 'not_launched' }

  const subscription = subscriptionEntitlement(db, userId)
  if (!subscription.active) return { ok: false, error: 'subscription_required' }
  if (!publicityPreferenceEnabled(db, userId)) return { ok: false, error: 'publicity_disabled' }

  const posts = rows(db, 'feedPosts')
  const existing = posts.find(row =>
    row.authorId === userId && row.metadata?.projectId === projectId && row.metadata?.shareKey === 'launch_publicity')
  if (existing) return { ok: true, postId: existing.id, idempotent: true }

  const title = String(project.title || 'A TechIT startup').trim()
  const tagline = String(project.tagline || project.oneLiner || project.description || '').trim()
  const body = `${title} just launched on TechIT Network.${tagline ? ` ${tagline}` : ''}`
  const post = {
    id: createId('feed_post'),
    authorId: userId,
    title: `${title} launched`,
    body,
    content: body,
    visibility: 'public',
    tags: [project.industry].filter(Boolean),
    metadata: { projectId, shareKey: 'launch_publicity', url: `${publicBaseUrl()}/startups/${projectId}` },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  posts.push(post)

  rows(db, 'notifications').push({
    id: createId('notif'),
    userId,
    actorId: null,
    type: 'publicity',
    read: false,
    content: 'Your launch is now public to the TechIT community.',
    linkTo: `/startups/${projectId}`,
    createdAt: nowIso(),
  })
  return { ok: true, postId: post.id }
}

export function publicizeLaunch(userId, projectId, options = {}) {
  return updateAuthorityDb(db => publicizeLaunchInDb(db, userId, projectId, options.project || null))
}

/** Best-effort: a launch broadcast must never break the stage write that triggered it. */
export function publicizeLaunchBestEffort(userId, projectId) {
  try {
    return publicizeLaunch(userId, projectId)
  } catch (error) {
    console.error(JSON.stringify({ event: 'publicity_failed', projectId, error: error.message }))
    return { ok: false, error: 'publicity_failed' }
  }
}
