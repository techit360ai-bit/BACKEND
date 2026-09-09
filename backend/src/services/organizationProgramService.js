import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { requireOrganizationPermission } from './organizationIntelligenceService.js'
import { evaluateOrganizationEntitlement } from './organizationEntitlementService.js'

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const text = value => typeof value === 'string' ? value.trim() : ''
const cleanObject = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) : {}

function orgAccess(userId, organizationId, permission = 'view') {
  return requireOrganizationPermission(userId, permission, organizationId)
}

export function listSponsorshipPackages(userId, organizationId = null) {
  const context = orgAccess(userId, organizationId, 'view')
  if (!context.ok) return context
  return { ok: true, organizationId: context.organizationId, packages: collection(readAuthorityDb(), 'organizationSponsorshipPackages').filter(row => row.organizationId === context.organizationId && row.status !== 'archived') }
}

export function createSponsorshipPackage(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'programs')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(context.organizationId, 'ORGANIZATION_SPONSOR_MANAGEMENT')
  if (!access.allowed) return access
  const name = text(body.name)
  if (!name) return { ok: false, error: 'sponsorship_package_name_required' }
  return updateAuthorityDb(db => {
    const row = { id: createId('sponsor_package'), organizationId: context.organizationId, name, description: text(body.description), packageType: text(body.packageType) || 'community', amount: body.amount ?? null, currency: text(body.currency) || null, benefits: Array.isArray(body.benefits) ? body.benefits.slice(0, 20) : [], status: 'active', createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'organizationSponsorshipPackages').push(row)
    return { ok: true, package: row }
  })
}

export function createSponsorshipApplication(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'view')
  if (!context.ok) return context
  const packageId = text(body.packageId)
  const sponsorName = text(body.sponsorName)
  if (!packageId || !sponsorName) return { ok: false, error: 'sponsorship_application_fields_required' }
  const pkg = collection(readAuthorityDb(), 'organizationSponsorshipPackages').find(row => row.id === packageId && row.organizationId === context.organizationId && row.status === 'active')
  if (!pkg) return { ok: false, error: 'sponsorship_package_not_found' }
  return updateAuthorityDb(db => {
    const application = { id: createId('sponsor_application'), organizationId: context.organizationId, packageId, sponsorName, sponsorContact: cleanObject(body.sponsorContact), status: 'submitted', requestedBenefits: Array.isArray(body.requestedBenefits) ? body.requestedBenefits.slice(0, 20) : [], createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'sponsorshipApplications').push(application)
    return { ok: true, application }
  })
}

export function hackathonOutcome(userId, hackathonId) {
  const db = readAuthorityDb()
  const hackathon = collection(db, 'hackathons').find(row => row.id === hackathonId && (row.ownerId === userId || (row.organizationId && collection(db, 'organizationMemberships').some(member => member.organizationId === row.organizationId && member.userId === userId && member.status === 'active'))))
  if (!hackathon) return { ok: false, error: 'hackathon_not_found' }
  const teams = collection(db, 'hackathonTeams').filter(row => row.hackathonId === hackathonId)
  const members = collection(db, 'hackathonMembers').filter(row => row.hackathonId === hackathonId)
  const finals = collection(db, 'hackathonFinalSubmissions').filter(row => row.hackathonId === hackathonId)
  const scores = collection(db, 'hackathonScores').filter(row => row.hackathonId === hackathonId)
  const completed = teams.filter(team => finals.some(final => final.teamId === team.id)).length
  const highPotential = teams.filter(team => scores.some(score => score.teamId === team.id && Number(score.score ?? score.total ?? 0) >= 70)).length
  return { ok: true, organizationId: hackathon.organizationId || null, hackathonId, report: { participants: members.length, teams: teams.length, completedProjects: completed, completionRate: teams.length ? Math.round(completed / teams.length * 1000) / 10 : 0, highPotentialCandidates: highPotential, investmentReadyCandidates: teams.filter(team => scores.some(score => score.teamId === team.id && Number(score.score ?? score.total ?? 0) >= 85)).length }, source: 'persisted_hackathon_records', generatedAt: nowIso() }
}

export function convertHackathonTeam(userId, hackathonId, teamId, body = {}) {
  if (body.consent !== true) return { ok: false, error: 'founder_consent_required' }
  return updateAuthorityDb(db => {
    const hackathon = collection(db, 'hackathons').find(row => row.id === hackathonId)
    const team = collection(db, 'hackathonTeams').find(row => row.id === teamId && row.hackathonId === hackathonId && row.leaderId === userId)
    if (!hackathon || !team) return { ok: false, error: 'hackathon_team_not_found' }
    const existing = collection(db, 'startupCandidates').find(row => row.hackathonId === hackathonId && row.teamId === teamId)
    if (existing) return { ok: true, idempotent: true, candidate: existing }
    const candidate = { id: createId('startup_candidate'), organizationId: hackathon.organizationId || null, hackathonId, teamId, founderId: userId, name: text(body.name) || team.name || 'Hackathon startup candidate', status: 'candidate', consentAt: nowIso(), consentVersion: text(body.consentVersion) || 'v1', createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'startupCandidates').push(candidate)
    return { ok: true, candidate }
  })
}

