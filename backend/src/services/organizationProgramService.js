import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { requireOrganizationPermission } from './organizationIntelligenceService.js'
import { evaluateOrganizationEntitlement } from './organizationEntitlementService.js'
import { createCase } from './supportService.js'

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

export function reviewSponsorshipApplication(userId, applicationId, body = {}) {
  const db = readAuthorityDb()
  const application = collection(db, 'sponsorshipApplications').find(row => row.id === applicationId)
  if (!application) return { ok: false, error: 'sponsorship_application_not_found' }
  const context = orgAccess(userId, application.organizationId, 'edit')
  if (!context.ok) return context
  const decision = text(body.status)
  if (!['approved', 'rejected'].includes(decision)) return { ok: false, error: 'invalid_sponsorship_decision' }
  return updateAuthorityDb(state => {
    const row = collection(state, 'sponsorshipApplications').find(item => item.id === applicationId)
    row.status = decision; row.reviewedBy = userId; row.reviewedAt = nowIso(); row.rejectionReason = decision === 'rejected' ? text(body.reason) : null; row.updatedAt = nowIso()
    return { ok: true, application: row }
  })
}

export function recordSponsorshipTransaction(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'edit')
  if (!context.ok) return context
  const applicationId = text(body.applicationId)
  if (!applicationId) return { ok: false, error: 'sponsorship_application_required' }
  const application = collection(readAuthorityDb(), 'sponsorshipApplications').find(row => row.id === applicationId && row.organizationId === context.organizationId)
  if (!application) return { ok: false, error: 'sponsorship_application_not_found' }
  if (!['approved', 'funded'].includes(application.status)) return { ok: false, error: 'sponsorship_application_not_approved' }
  return updateAuthorityDb(db => {
    const existing = collection(db, 'sponsorshipTransactions').find(row => row.providerReference && row.providerReference === text(body.providerReference))
    if (existing) return { ok: true, idempotent: true, transaction: existing }
    const transaction = { id: createId('sponsor_tx'), applicationId, organizationId, paymentIntentId: text(body.paymentIntentId) || null, provider: text(body.provider) || null, providerReference: text(body.providerReference) || null, amount: body.amount ?? 0, currency: text(body.currency) || null, credits: Number(body.credits || 0), status: text(body.status) || 'pending', createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'sponsorshipTransactions').push(transaction)
    return { ok: true, transaction }
  })
}

export function fulfillSponsorshipBenefit(userId, benefitId, body = {}) {
  const db = readAuthorityDb()
  const benefit = collection(db, 'sponsorshipBenefits').find(row => row.id === benefitId)
  if (!benefit) return { ok: false, error: 'sponsorship_benefit_not_found' }
  const context = orgAccess(userId, benefit.organizationId, 'edit')
  if (!context.ok) return context
  if (benefit.consentRequired === true) {
    const consent = collection(db, 'consentRecords').find(row => row.userId === userId && row.organizationId === benefit.organizationId && row.scope === 'sponsor_contact' && row.consent === true)
    if (!consent) return { ok: false, error: 'sponsor_contact_consent_required' }
  }
  return updateAuthorityDb(state => {
    const row = collection(state, 'sponsorshipBenefits').find(item => item.id === benefitId)
    row.status = 'fulfilled'; row.fulfilledBy = userId; row.fulfilledAt = nowIso(); row.metadata = { ...(row.metadata || {}), ...cleanObject(body.metadata) }; row.updatedAt = nowIso()
    return { ok: true, benefit: row }
  })
}

export function recordSponsorConsent(userId, body = {}) {
  const organizationId = text(body.organizationId)
  if (!organizationId || body.consent !== true) return { ok: false, error: 'sponsor_consent_required' }
  return updateAuthorityDb(db => {
    const existing = collection(db, 'consentRecords').find(row => row.userId === userId && row.organizationId === organizationId && row.scope === 'sponsor_contact')
    const row = existing || { id: createId('consent'), userId, organizationId, scope: 'sponsor_contact', createdAt: nowIso() }
    Object.assign(row, { consent: true, consentVersion: text(body.consentVersion) || 'v1', updatedAt: nowIso() })
    if (!existing) collection(db, 'consentRecords').push(row)
    return { ok: true, consent: row }
  })
}

export function createManagedHackathonOperation(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'programs')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(organizationId, 'ORGANIZATION_MANAGED_HACKATHON')
  if (!access.allowed) return access
  return updateAuthorityDb(db => {
    const operation = { id: createId('managed_hackathon'), organizationId, hackathonId: text(body.hackathonId) || null, serviceTier: text(body.serviceTier) || 'managed', status: 'requested', checklist: cleanObject(body.checklist), sla: cleanObject(body.sla), assignedTeam: text(body.assignedTeam) || null, createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'managedHackathonOperations').push(operation)
    return { ok: true, operation }
  })
}

export function saveInstitutionalSettings(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'edit')
  if (!context.ok) return context
  const capability = body.whiteLabel ? 'ORGANIZATION_WHITE_LABEL' : body.integrations ? 'ORGANIZATION_INTEGRATIONS' : null
  if (capability) { const access = evaluateOrganizationEntitlement(organizationId, capability); if (!access.allowed) return access }
  return updateAuthorityDb(db => {
    const records = collection(db, 'organizationInstitutionalSettings')
    const row = records.find(item => item.organizationId === organizationId) || { id: createId('org_institutional'), organizationId, createdAt: nowIso() }
    Object.assign(row, { whiteLabel: { ...(row.whiteLabel || {}), ...cleanObject(body.whiteLabel) }, integrations: { ...(row.integrations || {}), ...cleanObject(body.integrations) }, sla: { ...(row.sla || {}), ...cleanObject(body.sla) }, support: { ...(row.support || {}), ...cleanObject(body.support) }, updatedBy: userId, updatedAt: nowIso() })
    if (!records.includes(row)) records.push(row)
    return { ok: true, settings: row }
  })
}

export function requestOrganizationSupport(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'view')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(organizationId, 'ORGANIZATION_SUPPORT_WORKFLOW')
  if (!access.allowed) return access
  return createCase(userId, { category: body.category || 'platform', subcategory: 'organization_managed_service', subject: text(body.subject) || 'Organization program support', description: text(body.description) || 'Organization program support request.', severity: body.severity, organizationId, hackathonId: body.hackathonId || null, programId: body.programId || null }, 'organization')
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

export function listOrganizationAbuseReviews(_adminId, filters = {}) {
  const db = readAuthorityDb()
  const status = text(filters.status)
  return { ok: true, reviews: collection(db, 'organizationAbuseReviews').filter(row => !status || row.status === status).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) }
}

export function reviewOrganizationAbuse(adminId, reviewId, body = {}) {
  const decision = text(body.status)
  if (!['open', 'approved', 'rejected', 'dismissed'].includes(decision)) return { ok: false, error: 'invalid_abuse_review_status' }
  return updateAuthorityDb(db => {
    const row = collection(db, 'organizationAbuseReviews').find(item => item.id === reviewId)
    if (!row) return { ok: false, error: 'organization_abuse_review_not_found' }
    Object.assign(row, { status: decision, reviewedBy: adminId, reviewedAt: nowIso(), resolution: text(body.reason) || null, updatedAt: nowIso() })
    if (row.hackathonId && ['approved', 'rejected'].includes(decision)) {
      const hackathon = collection(db, 'hackathons').find(item => item.id === row.hackathonId)
      if (hackathon) hackathon.approvalStatus = decision
    }
    return { ok: true, review: row }
  })
}
