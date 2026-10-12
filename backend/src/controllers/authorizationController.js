import { deactivateRoleAssignmentAsync, roleAssignmentsAsync } from '../services/multiRoleContextService.js'
import { auditCapabilityDecisionAsync, authorizeCapabilityAsync, capabilityPoliciesForAdmin, roleActivationAsync, switchActiveRoleAsync, trustProfileForAsync, updateCapabilityPolicyAsync } from '../services/capabilityAuthorization.js'
import { addOrganizationMemberAsync, adminVerificationQueueAsync, analyzeEvidenceAsync, claimOrganizationAsync, createOrganizationAsync, generateReverificationNotificationsAsync, getVerificationProfileAsync, organizationMembershipsAsync, requestVerificationAsync, reviewVerificationAsync, riskProfileForAsync, submitEvidenceAsync, updateRiskStateAsync, verificationAnalyticsAsync } from '../services/trustVerificationService.js'
import { beginMfaEnrollmentAsync, mfaStatusAsync, verifyMfaAsync } from '../services/mfaService.js'
import { createEvidenceUploadAsync, finalizeEvidenceUpload } from '../services/evidenceStorageService.js'
import { identitySecurityEnabled, identitySecurityFallbackEnabled, listIdentitySecurity, syncIdentitySecurity } from '../repositories/identitySecurityRepository.js'
import { createDomainChallenge, registryCheck, registryConfigurations, reviewVerificationOperation, runRegistryCheck, verificationOperations, verifyDomainChallenge } from '../services/registryVerificationService.js'
import { reviewTrustProof, trustOperations } from '../services/trustAuthority.js'
import { decideInvestorTrustAccessAsync, investorTrustAccessStatusAsync, listFounderTrustAccessRequestsAsync, requestInvestorTrustAccessAsync } from '../services/investorTrustAccessService.js'

const body = req => req.body && typeof req.body === 'object' ? req.body : {}
const result = (res, value, success = 200) => value?.ok === false ? res.status(Number.isInteger(value.status) ? value.status : value.error === 'profile_not_found' ? 404 : 400).json(value) : res.status(success).json(value)
async function persistedSecurity(req, value, userId = req.user?.id) {
  if (!identitySecurityEnabled() || value?.ok === false || !userId) return value
  try { await syncIdentitySecurity(userId); return value } catch (error) { console.error(JSON.stringify({ event: 'identity_security_postgres_write_failed', userId, error: error.message })); if (identitySecurityFallbackEnabled()) return value; return { ok: false, error: 'identity_security_write_temporarily_unavailable' } }
}

export async function capabilities(_req, res) { return res.json({ capabilities: await capabilityPoliciesForAdmin() }) }
export async function capabilityCheck(req, res) { const decision = await authorizeCapabilityAsync(req.user.id, String(body(req).capability || req.query.capability || ''), { ...(req.user.activeContext || {}), ...(body(req).context || {}), mfaAssertion: req.get('x-mfa-assertion') }); await auditCapabilityDecisionAsync(decision, req.user.id); return res.json(decision) }
export async function activateRole(req, res) { return result(res, await persistedSecurity(req, await roleActivationAsync(req.user.id, body(req).role, body(req).profile || {})), 201) }
export async function switchRole(req, res) { return result(res, await persistedSecurity(req, await switchActiveRoleAsync(req.user.id, body(req).role))) }
export async function roleAssignmentList(req, res) { return res.json(await roleAssignmentsAsync(req.user.id)) }
export async function deactivateRole(req, res) { return result(res, await persistedSecurity(req, await deactivateRoleAssignmentAsync(req.user.id, req.params.role))) }
export async function verificationStatus(req, res) { if (identitySecurityEnabled()) { try { const [profiles, evidence, requests] = await Promise.all([listIdentitySecurity(req.user.id, 'verificationProfiles'), listIdentitySecurity(req.user.id, 'verificationEvidence'), listIdentitySecurity(req.user.id, 'verificationRequests')]); const role = req.query.role ? String(req.query.role).toLowerCase() : null; return res.json({ profile: profiles?.find(row => !role || String(row.role).toLowerCase() === role) || null, evidence: (evidence || []).filter(row => !role || String(row.role).toLowerCase() === role), requests: (requests || []).filter(row => !role || String(row.role).toLowerCase() === role) }) } catch (error) { if (!identitySecurityFallbackEnabled()) throw error } } return res.json(await getVerificationProfileAsync(req.user.id, req.query.role)) }
export async function verificationRequest(req, res) { return result(res, await persistedSecurity(req, await requestVerificationAsync(req.user.id, body(req)), req.user.id), 201) }
export async function verificationEvidence(req, res) { return result(res, await persistedSecurity(req, await submitEvidenceAsync(req.user.id, req.params.requestId, body(req)), req.user.id), 201) }
export async function trustProfile(req, res) { if (identitySecurityEnabled()) { try { const [trust, risk] = await Promise.all([listIdentitySecurity(req.user.id, 'trustProfiles'), listIdentitySecurity(req.user.id, 'riskProfiles')]); return res.json({ trust: trust?.[0] || await trustProfileForAsync(req.user.id, req.query.role), risk: risk?.[0] || null }) } catch (error) { if (!identitySecurityFallbackEnabled()) throw error } } return res.json({ trust: await trustProfileForAsync(req.user.id, req.query.role), risk: await riskProfileForAsync(req.user.id) }) }
export async function organizationCreate(req, res) { return result(res, await persistedSecurity(req, await createOrganizationAsync(req.user.id, body(req))), 201) }
export async function organizationClaim(req, res) { return result(res, await persistedSecurity(req, await claimOrganizationAsync(req.user.id, req.params.organizationId, body(req))), 201) }
export async function organizationMembership(req, res) { if (identitySecurityEnabled()) { try { const rows = await listIdentitySecurity(req.user.id, 'organizationMemberships'); return res.json({ memberships: rows?.filter(row => !req.params.organizationId || row.organizationId === req.params.organizationId) || [] }) } catch (error) { if (!identitySecurityFallbackEnabled()) throw error } } return res.json({ memberships: await organizationMembershipsAsync(req.user.id, req.params.organizationId) }) }
export async function adminVerificationQueue(_req, res) { return res.json(await adminVerificationQueueAsync()) }
export function registryCatalog(req, res) { return res.json({ configurations: registryConfigurations(req.query.country || null) }) }
export async function organizationRegistryCheck(req, res) { return result(res, await registryCheck(req.user.id, req.params.organizationId, body(req)), 201) }
export async function organizationDomainChallenge(req, res) { return result(res, await createDomainChallenge(req.user.id, req.params.organizationId, body(req)), 201) }
export async function organizationDomainVerify(req, res) { return result(res, await verifyDomainChallenge(req.user.id, req.params.challengeId)) }
export async function adminVerificationOperations(_req, res) { return res.json({ ...(await verificationOperations()), trust: await trustOperations() }) }
export async function adminRegistryCheckRun(req, res) { return result(res, await runRegistryCheck(req.params.checkId)) }
export async function adminVerificationOperationReview(req, res) { const operation = req.params.kind === 'trust_proof' ? await reviewTrustProof(req.user.id, req.params.operationId, body(req)) : await reviewVerificationOperation(req.user.id, req.params.kind, req.params.operationId, body(req)); return result(res, operation) }
export async function adminVerificationReview(req, res) { return result(res, await persistedSecurity(req, await reviewVerificationAsync(req.user.id, req.params.requestId, body(req)), body(req).userId || req.params.userId || req.user.id)) }
export async function adminCapabilityPolicies(_req, res) { return res.json({ policies: await capabilityPoliciesForAdmin() }) }
export async function adminCapabilityPolicyUpdate(req, res) { return result(res, await updateCapabilityPolicyAsync(req.user.id, req.params.capability, body(req).policy || body(req))) }
export async function organizationMemberAdd(req, res) { return result(res, await persistedSecurity(req, await addOrganizationMemberAsync(req.user.id, req.params.organizationId, body(req))), 201) }
export async function adminRiskUpdate(req, res) { return result(res, await persistedSecurity(req, await updateRiskStateAsync(req.user.id, req.params.userId, body(req).state, body(req).note), req.params.userId)) }
export async function mfaEnroll(req, res) { return result(res, await persistedSecurity(req, await beginMfaEnrollmentAsync(req.user.id, req.user.email))) }
export async function mfaVerify(req, res) { return result(res, await persistedSecurity(req, await verifyMfaAsync(req.user.id, body(req).code, body(req).enable !== false))) }
export async function mfaStatusGet(req, res) { if (identitySecurityEnabled()) { try { const rows = await listIdentitySecurity(req.user.id, 'mfaProfiles'); const profile = rows?.[0]; return res.json({ enabled: Boolean(profile?.enabled), verifiedAt: profile?.verifiedAt || null }) } catch (error) { if (!identitySecurityFallbackEnabled()) throw error } } return res.json(await mfaStatusAsync(req.user.id)) }
export async function evidenceUploadUrl(req, res) { return result(res, await createEvidenceUploadAsync(req.user.id, req.params.requestId, body(req)), 201) }
export async function evidenceUploadFinalize(req, res) { return result(res, await finalizeEvidenceUpload(req.user.id, req.params.objectId)) }
export async function verificationEvidenceAnalyze(req, res) { return result(res, await analyzeEvidenceAsync(req.user.id, req.user.token, req.params.requestId, body(req))) }
export async function adminVerificationAnalytics(_req, res) { return res.json(await verificationAnalyticsAsync()) }
export async function adminReverificationNotifications(_req, res) { return result(res, await generateReverificationNotificationsAsync()) }
export async function investorTrustAccessRequest(req, res) { return result(res, await requestInvestorTrustAccessAsync(req.user.id, req.params.projectId, body(req)), 201) }
export async function investorTrustAccessGet(req, res) { return result(res, await investorTrustAccessStatusAsync(req.user.id, req.params.projectId)) }
export async function founderTrustAccessList(req, res) { return result(res, await listFounderTrustAccessRequestsAsync(req.user.id, req.query.status ? String(req.query.status) : null)) }
export async function founderTrustAccessDecision(req, res) { return result(res, await decideInvestorTrustAccessAsync(req.user.id, req.params.requestId, body(req))) }
