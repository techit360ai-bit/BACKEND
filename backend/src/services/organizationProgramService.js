import { createId, nowIso } from '../utils/api.js'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { requireOrganizationPermission, requireOrganizationPermissionAsync } from './organizationIntelligenceService.js'
import { evaluateOrganizationEntitlement } from './organizationEntitlementService.js'
import { createCase, createCaseAsync } from './supportService.js'
import { organizationProgramEnabled, organizationProgramFallbackEnabled, readOrgProgramRecord, readOrgProgramSources, applyOrgProgramMutation } from '../repositories/organizationProgramRepository.js'

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const text = value => typeof value === 'string' ? value.trim() : ''
const cleanObject = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) : {}

function orgAccess(userId, organizationId, permission = 'view') {
  return requireOrganizationPermission(userId, permission, organizationId)
}
async function orgAccessAsync(userId, organizationId, permission = 'view') {
  return requireOrganizationPermissionAsync(userId, permission, organizationId)
}

async function withOrgProgramWrite(userId, options, fromDb, fallback) {
  if (!organizationProgramEnabled()) return fallback()
  try { return await applyOrgProgramMutation(userId, options, fromDb) } catch (error) {
    console.error(JSON.stringify({ event: 'organization_program_write_failed', error: error.message }))
    if (!organizationProgramFallbackEnabled()) throw error
    return fallback()
  }
}
async function withOrgProgramRead(userId, options, fromDb, fallback) {
  if (!organizationProgramEnabled()) return fallback()
  try { const db = await readOrgProgramSources(userId, options); return fromDb(db) } catch (error) {
    console.error(JSON.stringify({ event: 'organization_program_read_failed', error: error.message }))
    if (!organizationProgramFallbackEnabled()) throw error
    return fallback()
  }
}

function listSponsorshipPackagesFromDb(db, organizationId) {
  return { ok: true, organizationId, packages: collection(db, 'organizationSponsorshipPackages').filter(row => row.organizationId === organizationId && row.status !== 'archived') }
}
export function listSponsorshipPackages(userId, organizationId = null) {
  const context = orgAccess(userId, organizationId, 'view')
  if (!context.ok) return context
  return listSponsorshipPackagesFromDb(readAuthorityDb(), context.organizationId)
}
export async function listSponsorshipPackagesAsync(userId, organizationId = null) {
  const context = await orgAccessAsync(userId, organizationId, 'view')
  if (!context.ok) return context
  return withOrgProgramRead(userId, { organizationId: context.organizationId }, db => listSponsorshipPackagesFromDb(db, context.organizationId), () => listSponsorshipPackages(userId, organizationId))
}

function createSponsorshipPackageFromDb(db, userId, organizationId, body) {
  const row = { id: createId('sponsor_package'), organizationId, name: text(body.name), description: text(body.description), packageType: text(body.packageType) || 'community', amount: body.amount ?? null, currency: text(body.currency) || null, benefits: Array.isArray(body.benefits) ? body.benefits.slice(0, 20) : [], status: 'active', createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
  collection(db, 'organizationSponsorshipPackages').push(row)
  return { ok: true, package: row }
}
export function createSponsorshipPackage(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'programs')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(context.organizationId, 'ORGANIZATION_SPONSOR_MANAGEMENT')
  if (!access.allowed) return access
  const name = text(body.name)
  if (!name) return { ok: false, error: 'sponsorship_package_name_required' }
  return updateAuthorityDb(db => createSponsorshipPackageFromDb(db, userId, context.organizationId, body))
}
export async function createSponsorshipPackageAsync(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = await orgAccessAsync(userId, organizationId, 'programs')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(context.organizationId, 'ORGANIZATION_SPONSOR_MANAGEMENT')
  if (!access.allowed) return access
  if (!text(body.name)) return { ok: false, error: 'sponsorship_package_name_required' }
  return withOrgProgramWrite(userId, { organizationId: context.organizationId }, db => createSponsorshipPackageFromDb(db, userId, context.organizationId, body), () => createSponsorshipPackage(userId, body))
}

function createSponsorshipApplicationFromDb(db, userId, organizationId, body) {
  const packageId = text(body.packageId)
  const pkg = collection(db, 'organizationSponsorshipPackages').find(row => row.id === packageId && row.organizationId === organizationId && row.status === 'active')
  if (!pkg) return { ok: false, error: 'sponsorship_package_not_found' }
  const application = { id: createId('sponsor_application'), organizationId, packageId, sponsorName: text(body.sponsorName), sponsorContact: cleanObject(body.sponsorContact), status: 'submitted', requestedBenefits: Array.isArray(body.requestedBenefits) ? body.requestedBenefits.slice(0, 20) : [], createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
  collection(db, 'sponsorshipApplications').push(application)
  return { ok: true, application }
}
export function createSponsorshipApplication(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'view')
  if (!context.ok) return context
  if (!text(body.packageId) || !text(body.sponsorName)) return { ok: false, error: 'sponsorship_application_fields_required' }
  return updateAuthorityDb(db => createSponsorshipApplicationFromDb(db, userId, context.organizationId, body))
}
export async function createSponsorshipApplicationAsync(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = await orgAccessAsync(userId, organizationId, 'view')
  if (!context.ok) return context
  if (!text(body.packageId) || !text(body.sponsorName)) return { ok: false, error: 'sponsorship_application_fields_required' }
  return withOrgProgramWrite(userId, { organizationId: context.organizationId }, db => createSponsorshipApplicationFromDb(db, userId, context.organizationId, body), () => createSponsorshipApplication(userId, body))
}

function reviewSponsorshipApplicationFromDb(db, userId, applicationId, body) {
  const row = collection(db, 'sponsorshipApplications').find(item => item.id === applicationId)
  if (!row) return { ok: false, error: 'sponsorship_application_not_found' }
  const decision = text(body.status)
  if (!['approved', 'rejected'].includes(decision)) return { ok: false, error: 'invalid_sponsorship_decision' }
  row.status = decision; row.reviewedBy = userId; row.reviewedAt = nowIso(); row.rejectionReason = decision === 'rejected' ? text(body.reason) : null; row.updatedAt = nowIso()
  return { ok: true, application: row }
}
export function reviewSponsorshipApplication(userId, applicationId, body = {}) {
  const db = readAuthorityDb()
  const application = collection(db, 'sponsorshipApplications').find(row => row.id === applicationId)
  if (!application) return { ok: false, error: 'sponsorship_application_not_found' }
  const context = orgAccess(userId, application.organizationId, 'edit')
  if (!context.ok) return context
  return updateAuthorityDb(state => reviewSponsorshipApplicationFromDb(state, userId, applicationId, body))
}
export async function reviewSponsorshipApplicationAsync(userId, applicationId, body = {}) {
  if (!organizationProgramEnabled()) return reviewSponsorshipApplication(userId, applicationId, body)
  const application = await readOrgProgramRecord('sponsorshipApplications', applicationId)
  if (!application) return { ok: false, error: 'sponsorship_application_not_found' }
  const context = await orgAccessAsync(userId, application.organizationId, 'edit')
  if (!context.ok) return context
  return withOrgProgramWrite(userId, { organizationId: context.organizationId, ids: { sponsorshipApplications: [applicationId] } }, db => reviewSponsorshipApplicationFromDb(db, userId, applicationId, body), () => reviewSponsorshipApplication(userId, applicationId, body))
}

function recordSponsorshipTransactionFromDb(db, body) {
  const applicationId = text(body.applicationId)
  const application = collection(db, 'sponsorshipApplications').find(row => row.id === applicationId)
  if (!application) return { ok: false, error: 'sponsorship_application_not_found' }
  if (!['approved', 'funded'].includes(application.status)) return { ok: false, error: 'sponsorship_application_not_approved' }
  const existing = collection(db, 'sponsorshipTransactions').find(row => row.providerReference && row.providerReference === text(body.providerReference))
  if (existing) return { ok: true, idempotent: true, transaction: existing }
  const transaction = { id: createId('sponsor_tx'), applicationId, organizationId: application.organizationId, paymentIntentId: text(body.paymentIntentId) || null, provider: text(body.provider) || null, providerReference: text(body.providerReference) || null, amount: body.amount ?? 0, currency: text(body.currency) || null, credits: Number(body.credits || 0), status: text(body.status) || 'pending', createdAt: nowIso(), updatedAt: nowIso() }
  collection(db, 'sponsorshipTransactions').push(transaction)
  return { ok: true, transaction }
}
export function recordSponsorshipTransaction(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'edit')
  if (!context.ok) return context
  if (!text(body.applicationId)) return { ok: false, error: 'sponsorship_application_required' }
  const db = readAuthorityDb()
  const application = collection(db, 'sponsorshipApplications').find(row => row.id === text(body.applicationId) && row.organizationId === context.organizationId)
  if (!application) return { ok: false, error: 'sponsorship_application_not_found' }
  return updateAuthorityDb(state => recordSponsorshipTransactionFromDb(state, body))
}
export async function recordSponsorshipTransactionAsync(userId, body = {}) {
  if (!organizationProgramEnabled()) return recordSponsorshipTransaction(userId, body)
  const applicationId = text(body.applicationId)
  if (!applicationId) return { ok: false, error: 'sponsorship_application_required' }
  const application = await readOrgProgramRecord('sponsorshipApplications', applicationId)
  if (!application) return { ok: false, error: 'sponsorship_application_not_found' }
  const context = await orgAccessAsync(userId, application.organizationId, 'edit')
  if (!context.ok) return context
  return withOrgProgramWrite(userId, { organizationId: context.organizationId, ids: { sponsorshipApplications: [applicationId] } }, db => recordSponsorshipTransactionFromDb(db, body), () => recordSponsorshipTransaction(userId, body))
}

function fulfillSponsorshipBenefitFromDb(db, userId, benefitId, body) {
  const row = collection(db, 'sponsorshipBenefits').find(item => item.id === benefitId)
  if (!row) return { ok: false, error: 'sponsorship_benefit_not_found' }
  if (row.consentRequired === true) {
    const consent = collection(db, 'consentRecords').find(item => item.userId === userId && item.organizationId === row.organizationId && item.scope === 'sponsor_contact' && item.consent === true)
    if (!consent) return { ok: false, error: 'sponsor_contact_consent_required' }
  }
  row.status = 'fulfilled'; row.fulfilledBy = userId; row.fulfilledAt = nowIso(); row.metadata = { ...(row.metadata || {}), ...cleanObject(body.metadata) }; row.updatedAt = nowIso()
  return { ok: true, benefit: row }
}
export function fulfillSponsorshipBenefit(userId, benefitId, body = {}) {
  const db = readAuthorityDb()
  const benefit = collection(db, 'sponsorshipBenefits').find(row => row.id === benefitId)
  if (!benefit) return { ok: false, error: 'sponsorship_benefit_not_found' }
  const context = orgAccess(userId, benefit.organizationId, 'edit')
  if (!context.ok) return context
  return updateAuthorityDb(state => fulfillSponsorshipBenefitFromDb(state, userId, benefitId, body))
}
export async function fulfillSponsorshipBenefitAsync(userId, benefitId, body = {}) {
  if (!organizationProgramEnabled()) return fulfillSponsorshipBenefit(userId, benefitId, body)
  const benefit = await readOrgProgramRecord('sponsorshipBenefits', benefitId)
  if (!benefit) return { ok: false, error: 'sponsorship_benefit_not_found' }
  const context = await orgAccessAsync(userId, benefit.organizationId, 'edit')
  if (!context.ok) return context
  return withOrgProgramWrite(userId, { organizationId: context.organizationId, ids: { sponsorshipBenefits: [benefitId] } }, db => fulfillSponsorshipBenefitFromDb(db, userId, benefitId, body), () => fulfillSponsorshipBenefit(userId, benefitId, body))
}

function recordSponsorConsentFromDb(db, userId, organizationId, body) {
  const existing = collection(db, 'consentRecords').find(row => row.userId === userId && row.organizationId === organizationId && row.scope === 'sponsor_contact')
  const row = existing || { id: createId('consent'), userId, organizationId, scope: 'sponsor_contact', createdAt: nowIso() }
  Object.assign(row, { consent: true, consentVersion: text(body.consentVersion) || 'v1', updatedAt: nowIso() })
  if (!existing) collection(db, 'consentRecords').push(row)
  return { ok: true, consent: row }
}
export function recordSponsorConsent(userId, body = {}) {
  const organizationId = text(body.organizationId)
  if (!organizationId || body.consent !== true) return { ok: false, error: 'sponsor_consent_required' }
  return updateAuthorityDb(db => recordSponsorConsentFromDb(db, userId, organizationId, body))
}
export async function recordSponsorConsentAsync(userId, body = {}) {
  const organizationId = text(body.organizationId)
  if (!organizationId || body.consent !== true) return { ok: false, error: 'sponsor_consent_required' }
  return withOrgProgramWrite(userId, { organizationId }, db => recordSponsorConsentFromDb(db, userId, organizationId, body), () => recordSponsorConsent(userId, body))
}

function createManagedHackathonOperationFromDb(db, userId, organizationId, body) {
  const operation = { id: createId('managed_hackathon'), organizationId, hackathonId: text(body.hackathonId) || null, serviceTier: text(body.serviceTier) || 'managed', status: 'requested', checklist: cleanObject(body.checklist), sla: cleanObject(body.sla), assignedTeam: text(body.assignedTeam) || null, createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
  collection(db, 'managedHackathonOperations').push(operation)
  return { ok: true, operation }
}
export function createManagedHackathonOperation(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'programs')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(organizationId, 'ORGANIZATION_MANAGED_HACKATHON')
  if (!access.allowed) return access
  return updateAuthorityDb(db => createManagedHackathonOperationFromDb(db, userId, organizationId, body))
}
export async function createManagedHackathonOperationAsync(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = await orgAccessAsync(userId, organizationId, 'programs')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(organizationId, 'ORGANIZATION_MANAGED_HACKATHON')
  if (!access.allowed) return access
  return withOrgProgramWrite(userId, { organizationId }, db => createManagedHackathonOperationFromDb(db, userId, organizationId, body), () => createManagedHackathonOperation(userId, body))
}

function saveInstitutionalSettingsFromDb(db, userId, organizationId, body) {
  const records = collection(db, 'organizationInstitutionalSettings')
  const row = records.find(item => item.organizationId === organizationId) || { id: createId('org_institutional'), organizationId, createdAt: nowIso() }
  Object.assign(row, { whiteLabel: { ...(row.whiteLabel || {}), ...cleanObject(body.whiteLabel) }, integrations: { ...(row.integrations || {}), ...cleanObject(body.integrations) }, sla: { ...(row.sla || {}), ...cleanObject(body.sla) }, support: { ...(row.support || {}), ...cleanObject(body.support) }, updatedBy: userId, updatedAt: nowIso() })
  if (!records.includes(row)) records.push(row)
  return { ok: true, settings: row }
}
export function saveInstitutionalSettings(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'edit')
  if (!context.ok) return context
  const capability = body.whiteLabel ? 'ORGANIZATION_WHITE_LABEL' : body.integrations ? 'ORGANIZATION_INTEGRATIONS' : null
  if (capability) { const access = evaluateOrganizationEntitlement(organizationId, capability); if (!access.allowed) return access }
  return updateAuthorityDb(db => saveInstitutionalSettingsFromDb(db, userId, organizationId, body))
}
export async function saveInstitutionalSettingsAsync(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = await orgAccessAsync(userId, organizationId, 'edit')
  if (!context.ok) return context
  const capability = body.whiteLabel ? 'ORGANIZATION_WHITE_LABEL' : body.integrations ? 'ORGANIZATION_INTEGRATIONS' : null
  if (capability) { const access = evaluateOrganizationEntitlement(organizationId, capability); if (!access.allowed) return access }
  return withOrgProgramWrite(userId, { organizationId }, db => saveInstitutionalSettingsFromDb(db, userId, organizationId, body), () => saveInstitutionalSettings(userId, body))
}

export function requestOrganizationSupport(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = orgAccess(userId, organizationId, 'view')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(organizationId, 'ORGANIZATION_SUPPORT_WORKFLOW')
  if (!access.allowed) return access
  return createCase(userId, { category: body.category || 'platform', subcategory: 'organization_managed_service', subject: text(body.subject) || 'Organization program support', description: text(body.description) || 'Organization program support request.', severity: body.severity, organizationId, hackathonId: body.hackathonId || null, programId: body.programId || null }, 'organization')
}
export async function requestOrganizationSupportAsync(userId, body = {}) {
  const organizationId = text(body.organizationId)
  const context = await orgAccessAsync(userId, organizationId, 'view')
  if (!context.ok) return context
  const access = evaluateOrganizationEntitlement(organizationId, 'ORGANIZATION_SUPPORT_WORKFLOW')
  if (!access.allowed) return access
  return createCaseAsync(userId, { category: body.category || 'platform', subcategory: 'organization_managed_service', subject: text(body.subject) || 'Organization program support', description: text(body.description) || 'Organization program support request.', severity: body.severity, organizationId, hackathonId: body.hackathonId || null, programId: body.programId || null }, 'organization')
}

function hackathonOutcomeFromDb(db, userId, hackathonId) {
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
export function hackathonOutcome(userId, hackathonId) {
  return hackathonOutcomeFromDb(readAuthorityDb(), userId, hackathonId)
}
export async function hackathonOutcomeAsync(userId, hackathonId) {
  return withOrgProgramRead(userId, { hackathonId }, db => hackathonOutcomeFromDb(db, userId, hackathonId), () => hackathonOutcome(userId, hackathonId))
}

function convertHackathonTeamFromDb(db, userId, hackathonId, teamId, body) {
  if (body.consent !== true) return { ok: false, error: 'founder_consent_required' }
  const hackathon = collection(db, 'hackathons').find(row => row.id === hackathonId)
  const team = collection(db, 'hackathonTeams').find(row => row.id === teamId && row.hackathonId === hackathonId && row.leaderId === userId)
  if (!hackathon || !team) return { ok: false, error: 'hackathon_team_not_found' }
  const existing = collection(db, 'startupCandidates').find(row => row.hackathonId === hackathonId && row.teamId === teamId)
  if (existing) return { ok: true, idempotent: true, candidate: existing }
  const candidate = { id: createId('startup_candidate'), organizationId: hackathon.organizationId || null, hackathonId, teamId, founderId: userId, name: text(body.name) || team.name || 'Hackathon startup candidate', status: 'candidate', consentAt: nowIso(), consentVersion: text(body.consentVersion) || 'v1', createdAt: nowIso(), updatedAt: nowIso() }
  collection(db, 'startupCandidates').push(candidate)
  return { ok: true, candidate }
}
export function convertHackathonTeam(userId, hackathonId, teamId, body = {}) {
  if (body.consent !== true) return { ok: false, error: 'founder_consent_required' }
  return updateAuthorityDb(db => convertHackathonTeamFromDb(db, userId, hackathonId, teamId, body))
}
export async function convertHackathonTeamAsync(userId, hackathonId, teamId, body = {}) {
  if (body.consent !== true) return { ok: false, error: 'founder_consent_required' }
  return withOrgProgramWrite(userId, { hackathonId }, db => convertHackathonTeamFromDb(db, userId, hackathonId, teamId, body), () => convertHackathonTeam(userId, hackathonId, teamId, body))
}

function listOrganizationAbuseReviewsFromDb(db, filters = {}) {
  const status = text(filters.status)
  return { ok: true, reviews: collection(db, 'organizationAbuseReviews').filter(row => !status || row.status === status).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) }
}
export function listOrganizationAbuseReviews(_adminId, filters = {}) {
  return listOrganizationAbuseReviewsFromDb(readAuthorityDb(), filters)
}
export async function listOrganizationAbuseReviewsAsync(adminId, filters = {}) {
  return withOrgProgramRead(adminId, {}, db => listOrganizationAbuseReviewsFromDb(db, filters), () => listOrganizationAbuseReviews(adminId, filters))
}

function reviewOrganizationAbuseFromDb(db, adminId, reviewId, body) {
  const decision = text(body.status)
  if (!['open', 'approved', 'rejected', 'dismissed'].includes(decision)) return { ok: false, error: 'invalid_abuse_review_status' }
  const row = collection(db, 'organizationAbuseReviews').find(item => item.id === reviewId)
  if (!row) return { ok: false, error: 'organization_abuse_review_not_found' }
  Object.assign(row, { status: decision, reviewedBy: adminId, reviewedAt: nowIso(), resolution: text(body.reason) || null, updatedAt: nowIso() })
  if (row.hackathonId && ['approved', 'rejected'].includes(decision)) {
    const hackathon = collection(db, 'hackathons').find(item => item.id === row.hackathonId)
    if (hackathon) hackathon.approvalStatus = decision
  }
  return { ok: true, review: row }
}
export function reviewOrganizationAbuse(adminId, reviewId, body = {}) {
  return updateAuthorityDb(db => reviewOrganizationAbuseFromDb(db, adminId, reviewId, body))
}
export async function reviewOrganizationAbuseAsync(adminId, reviewId, body = {}) {
  if (!organizationProgramEnabled()) return reviewOrganizationAbuse(adminId, reviewId, body)
  const review = await readOrgProgramRecord('organizationAbuseReviews', reviewId)
  const hackathonId = review?.hackathonId || null
  return withOrgProgramWrite(adminId, { hackathonId, ids: { organizationAbuseReviews: [reviewId] } }, db => reviewOrganizationAbuseFromDb(db, adminId, reviewId, body), () => reviewOrganizationAbuse(adminId, reviewId, body))
}
