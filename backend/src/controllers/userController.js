import { readDb, writeDb } from '../config/database.js'

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
