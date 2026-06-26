import { readDb, writeDb } from '../config/database.js'
import { avatarGradient, createId, nowIso, timeAgo, userName } from '../utils/api.js'

const UPDATABLE = new Set([
  'firstName', 'lastName', 'username', 'phone', 'country', 'countryCode',
  'avatarUrl', 'bio', 'role', 'secondaryRoles', 'creditBalance', 'credibilityScore',
  'isVerified', 'isOnboarded', 'startupStage', 'industries', 'experience',
  'skills', 'weeklyHours', 'riskTolerance', 'investmentFocus', 'ticketSize',
  'orgName', 'orgType', 'website', 'linkedinUrl', 'githubUrl', 'portfolioUrl',
  'timezone', 'certifications',
])

export function getMe(req, res) {
  const db = readDb()
  const profile = db.profiles.find(p => p.id === req.user.id)
  if (!profile) return res.status(404).json({ error: 'Profile not found' })
  return res.json(profile)
}

export function updateMe(req, res) {
  const db = readDb()
  const idx = db.profiles.findIndex(p => p.id === req.user.id)
  if (idx === -1) return res.status(404).json({ error: 'Profile not found' })

  const updates = {}
  for (const [key, value] of Object.entries(req.body)) {
    if (UPDATABLE.has(key)) updates[key] = value
  }

  db.profiles[idx] = { ...db.profiles[idx], ...updates, updatedAt: new Date().toISOString() }
  writeDb(db)
  return res.json(db.profiles[idx])
}

function publicProfile(profile, db, viewerId) {
  const posts = db.feedPosts.filter(p => p.authorId === profile.id)
  const comments = db.feedComments.filter(c => c.authorId === profile.id)
  const connections = db.notifications.filter(n => n.userId === profile.id && n.type === 'collab').length
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
    isOwnProfile: viewerId === profile.id,
    stats: {
      decay: 1,
      stageProgress: profile.isOnboarded ? 100 : 20,
      posts: posts.length,
      answers: comments.length,
      connections,
    },
    skills: profile.skills || [],
    recentActivity,
  }
}

export function getUserProfile(req, res) {
  const db = readDb()
  const id = req.params.id === 'me' ? req.user.id : req.params.id
  const profile = db.profiles.find(p => p.id === id || p.username === id)
  if (!profile) return res.status(404).json({ error: 'Profile not found' })
  return res.json(publicProfile(profile, db, req.user.id))
}

export function connectUser(req, res) {
  const db = readDb()
  const target = db.profiles.find(p => p.id === req.params.id || p.username === req.params.id)
  const actor = db.profiles.find(p => p.id === req.user.id)
  if (!target) return res.status(404).json({ error: 'Profile not found' })
  if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot connect with yourself' })
  const exists = db.notifications.some(n =>
    n.userId === target.id &&
    n.actorId === req.user.id &&
    n.type === 'collab' &&
    n.linkTo === `/feed/profile/${req.user.id}`
  )
  if (!exists) {
    db.notifications.push({
      id: createId('notif'),
      userId: target.id,
      actorId: req.user.id,
      type: 'collab',
      read: false,
      content: 'wants to connect with you',
      author: userName(actor),
      avatar: avatarGradient(req.user.id),
      linkTo: `/feed/profile/${req.user.id}`,
      createdAt: nowIso(),
    })
    writeDb(db)
  }
  return res.json({ ok: true })
}
