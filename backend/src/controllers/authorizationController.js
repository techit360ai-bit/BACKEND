import { readDb as readAuthorityDb } from '../config/database.js'
import { deactivateRoleAssignment, roleAssignmentsAsync } from '../services/multiRoleContextService.js'
import { auditCapabilityDecision, authorizeCapability, CAPABILITY_POLICIES, capabilityPolicy, roleActivation, switchActiveRole, trustProfileFor, updateCapabilityPolicy } from '../services/capabilityAuthorization.js'
import { addOrganizationMember, analyzeEvidence, claimOrganization, createOrganization, generateReverificationNotifications, getVerificationProfile, organizationMemberships, requestVerification, reviewVerification, submitEvidence, updateRiskState, verificationAnalytics } from '../services/trustVerificationService.js'
import { beginMfaEnrollment, mfaStatus, verifyMfa } from '../services/mfaService.js'
import { createEvidenceUpload, finalizeEvidenceUpload } from '../services/evidenceStorageService.js'
import { identitySecurityEnabled, identitySecurityFallbackEnabled, listIdentitySecurity, syncIdentitySecurity } from '../repositories/identitySecurityRepository.js'
import { createDomainChallenge, registryCheck, registryConfigurations, reviewVerificationOperation, runRegistryCheck, verificationOperations, verifyDomainChallenge } from '../services/registryVerificationService.js'

const body = req => req.body && typeof req.body === 'object' ? req.body : {}
const result = (res, value, success = 200) => value?.ok === false ? res.status(Number.isInteger(value.status) ? value.status : value.error === 'profile_not_found' ? 404 : 400).json(value) : res.status(success).json(value)
async function persistedSecurity(req, value, userId = req.user?.id) {
  if (!identitySecurityEnabled() || value?.ok === false || !userId) return value
  try { await syncIdentitySecurity(userId); return value } catch (error) { console.error(JSON.stringify({ event: 'identity_security_postgres_write_failed', userId, error: error.message })); if (identitySecurityFallbackEnabled()) return value; return { ok: false, error: 'identity_security_write_temporarily_unavailable' } }
}

export function capabilities(_req, res) { return res.json({ capabilities: Object.keys(CAPABILITY_POLICIES).map(capability => ({ capability, policy: capabilityPolicy(capability) })) }) }
export function capabilityCheck(req, res) { const decision = authorizeCapability(req.user.id, String(body(req).capability || req.query.capability || ''), { ...(req.user.activeContext || {}), ...(body(req).context || {}), mfaAssertion: req.get('x-mfa-assertion') }); auditCapabilityDecision(decision, req.user.id); return res.json(decision) }
export async function activateRole(req, res) { return result(res, await persistedSecurity(req, roleActivation(req.user.id, body(req).role, body(req).profile || {})), 201) }
export async function switchRole(req, res) { return result(res, await persistedSecurity(req, switchActiveRole(req.user.id, body(req).role))) }
export async function roleAssignmentList(req, res) { return res.json(await roleAssignmentsAsync(req.user.id)) }
export async function deactivateRole(req, res) { return result(res, await persistedSecurity(req, deactivateRoleAssignment(req.user.id, req.params.role))) }
export async function verificationStatus(req, res) { if (identitySecurityEnabled()) { try { const [profiles, evidence, requests] = await Promise.all([listIdentitySecurity(req.user.id, 'verificationProfiles'), listIdentitySecurity(req.user.id, 'verificationEvidence'), listIdentitySecurity(req.user.id, 'verificationRequests')]); const role = req.query.role ? String(req.query.role).toLowerCase() : null; return res.json({ profile: profiles?.find(row => !role || String(row.role).toLowerCase() === role) || null, evidence: (evidence || []).filter(row => !role || String(row.role).toLowerCase() === role), requests: (requests || []).filter(row => !role || String(row.role).toLowerCase() === role) }) } catch (error) { if (!identitySecurityFallbackEnabled()) throw error } } return res.json(getVerificationProfile(req.user.id, req.query.role)) }
export async function verificationRequest(req, res) { return result(res, await persistedSecurity(req, requestVerification(req.user.id, body(req)), req.user.id), 201) }
export async function verificationEvidence(req, res) { return result(res, await persistedSecurity(req, submitEvidence(req.user.id, req.params.requestId, body(req)), req.user.id), 201) }
export async function trustProfile(req, res) { if (identitySecurityEnabled()) { try { const [trust, risk] = await Promise.all([listIdentitySecurity(req.user.id, 'trustProfiles'), listIdentitySecurity(req.user.id, 'riskProfiles')]); return res.json({ trust: trust?.[0] || trustProfileFor(req.user.id, req.query.role), risk: risk?.[0] || null }) } catch (error) { if (!identitySecurityFallbackEnabled()) throw error } } const db = readAuthorityDb(); return res.json({ trust: trustProfileFor(req.user.id, req.query.role), risk: (db.riskProfiles || []).find(row => row.userId === req.user.id) || null }) }
export async function organizationCreate(req, res) { return result(res, await persistedSecurity(req, createOrganization(req.user.id, body(req))), 201) }
export async function organizationClaim(req, res) { return result(res, await persistedSecurity(req, claimOrganization(req.user.id, req.params.organizationId, body(req))), 201) }
export async function organizationMembership(req, res) { if (identitySecurityEnabled()) { try { const rows = await listIdentitySecurity(req.user.id, 'organizationMemberships'); return res.json({ memberships: rows?.filter(row => !req.params.organizationId || row.organizationId === req.params.organizationId) || [] }) } catch (error) { if (!identitySecurityFallbackEnabled()) throw error } } return res.json({ memberships: organizationMemberships(req.user.id, req.params.organizationId) }) }
export function adminVerificationQueue(_req, res) { const db = readAuthorityDb(); return res.json({ requests: db.verificationRequests || [], evidence: db.verificationEvidence || [], reviews: db.manualReviews || [] }) }
export function registryCatalog(req, res) { return res.json({ configurations: registryConfigurations(req.query.country || null) }) }
export function organizationRegistryCheck(req, res) { return result(res, registryCheck(req.user.id, req.params.organizationId, body(req)), 201) }
export function organizationDomainChallenge(req, res) { return result(res, createDomainChallenge(req.user.id, req.params.organizationId, body(req)), 201) }
export async function organizationDomainVerify(req, res) { return result(res, await verifyDomainChallenge(req.user.id, req.params.challengeId)) }
export function adminVerificationOperations(_req, res) { return res.json(verificationOperations()) }
export async function adminRegistryCheckRun(req, res) { return result(res, await runRegistryCheck(req.params.checkId)) }
export function adminVerificationOperationReview(req, res) { return result(res, reviewVerificationOperation(req.user.id, req.params.kind, req.params.operationId, body(req))) }
export async function adminVerificationReview(req, res) { return result(res, await persistedSecurity(req, reviewVerification(req.user.id, req.params.requestId, body(req)), body(req).userId || req.params.userId || req.user.id)) }
export function adminCapabilityPolicies(_req, res) { return res.json({ policies: Object.keys(CAPABILITY_POLICIES).map(capability => ({ capability, policy: capabilityPolicy(capability) })) }) }
export function adminCapabilityPolicyUpdate(req, res) { return result(res, updateCapabilityPolicy(req.user.id, req.params.capability, body(req).policy || body(req))) }
export async function organizationMemberAdd(req, res) { return result(res, await persistedSecurity(req, addOrganizationMember(req.user.id, req.params.organizationId, body(req))), 201) }
export async function adminRiskUpdate(req, res) { return result(res, await persistedSecurity(req, updateRiskState(req.user.id, req.params.userId, body(req).state, body(req).note), req.params.userId)) }
export async function mfaEnroll(req, res) { return result(res, await persistedSecurity(req, beginMfaEnrollment(req.user.id, req.user.email))) }
export async function mfaVerify(req, res) { return result(res, await persistedSecurity(req, verifyMfa(req.user.id, body(req).code, body(req).enable !== false))) }
export async function mfaStatusGet(req, res) { if (identitySecurityEnabled()) { try { const rows = await listIdentitySecurity(req.user.id, 'mfaProfiles'); const profile = rows?.[0]; return res.json({ enabled: Boolean(profile?.enabled), verifiedAt: profile?.verifiedAt || null }) } catch (error) { if (!identitySecurityFallbackEnabled()) throw error } } return res.json(mfaStatus(req.user.id)) }
export function evidenceUploadUrl(req, res) { return result(res, createEvidenceUpload(req.user.id, req.params.requestId, body(req)), 201) }
export async function evidenceUploadFinalize(req, res) { return result(res, await finalizeEvidenceUpload(req.user.id, req.params.objectId)) }
export async function verificationEvidenceAnalyze(req, res) { return result(res, await analyzeEvidence(req.user.id, req.user.token, req.params.requestId, body(req))) }
export function adminVerificationAnalytics(_req, res) { return res.json(verificationAnalytics()) }
export function adminReverificationNotifications(_req, res) { return result(res, generateReverificationNotifications()) }
