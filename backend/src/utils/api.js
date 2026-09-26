import { randomUUID } from 'crypto'

export function nowIso() {
  return new Date().toISOString()
}

export function createId(prefix) {
  return `${prefix}_${randomUUID()}`
}

export function userName(profile, fallback = 'Unknown user') {
  if (!profile) return fallback
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
  return name || profile.username || profile.email || fallback
}

export function timeAgo(iso) {
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return ''
  const diff = Date.now() - ts
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  return `${Math.floor(diff / day)}d ago`
}

export function avatarGradient(seed = '') {
  const gradients = [
    'from-accent-primary to-score-blue',
    'from-score-green to-score-amber',
    'from-score-purple to-accent-primary',
    'from-score-amber to-score-red',
    'from-score-blue to-score-purple',
  ]
  let hash = 0
  for (const ch of seed) hash = (hash + ch.charCodeAt(0)) % gradients.length
  return gradients[hash]
}

export function requireBodyString(res, value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    res.status(400).json({ error: `${label} is required` })
    return null
  }
  return value.trim()
}

// Explicit allow-list for the account owner's own profile response.
//
// Responses must be built from this list rather than spreading the stored row,
// otherwise any internal column added later (storage object keys, moderation
// flags, projection metadata) silently becomes client-visible. This mirrors the
// `Profile` contract the frontend consumes.
export const OWN_PROFILE_FIELDS = Object.freeze([
  'id', 'email', 'firstName', 'lastName', 'username', 'phone', 'country', 'countryCode',
  'avatarUrl', 'bio', 'role', 'activeRole', 'secondaryRoles', 'roleProfiles', 'creditBalance',
  'credibilityScore', 'isVerified', 'isOnboarded', 'startupStage', 'industries', 'experience',
  'skills', 'weeklyHours', 'riskTolerance', 'investmentFocus', 'ticketSize',
  'orgName', 'orgType', 'website', 'linkedinUrl', 'githubUrl', 'portfolioUrl', 'timezone',
  'title', 'twitterUrl', 'yearsBuilding', 'founderType', 'oneLiner', 'foundingYear', 'logoEmoji',
  'currentTeamSize', 'openRoles', 'compensationOffered', 'equityRangeMin', 'equityRangeMax',
  'launchStatus', 'users', 'revenueMonthly', 'fundingRaised', 'leadInvestor', 'nextMilestone',
  'whyBuilding', 'winningIn3Years', 'unfairAdvantage', 'ownershipPhilosophy',
  'yearsExperience', 'discipline', 'subSkills', 'techStack', 'earliestStart', 'commitmentStyle',
  'equityPreference', 'minCashFloor', 'vestingComfort', 'certifications', 'createdAt', 'updatedAt',
])

export function projectOwnProfile(profile) {
  if (!profile || typeof profile !== 'object') return profile
  const projected = {}
  for (const field of OWN_PROFILE_FIELDS) {
    if (profile[field] !== undefined) projected[field] = profile[field]
  }
  return projected
}
