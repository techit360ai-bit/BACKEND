import { readDb } from '../config/database.js'
import { deactivateRoleAssignment, roleAssignments } from '../services/multiRoleContextService.js'
import { auditCapabilityDecision, authorizeCapability, CAPABILITY_POLICIES, capabilityPolicy, roleActivation, switchActiveRole, trustProfileFor, updateCapabilityPolicy } from '../services/capabilityAuthorization.js'
import { addOrganizationMember, analyzeEvidence, claimOrganization, createOrganization, generateReverificationNotifications, getVerificationProfile, organizationMemberships, requestVerification, reviewVerification, submitEvidence, updateRiskState, verificationAnalytics } from '../services/trustVerificationService.js'
import { beginMfaEnrollment, mfaStatus, verifyMfa } from '../services/mfaService.js'
import { createEvidenceUpload, finalizeEvidenceUpload } from '../services/evidenceStorageService.js'

const body = req => req.body && typeof req.body === 'object' ? req.body : {}
const result = (res, value, success = 200) => value?.ok === false ? res.status(value.error === 'profile_not_found' ? 404 : 400).json(value) : res.status(success).json(value)

export function capabilities(_req, res) { return res.json({ capabilities: Object.keys(CAPABILITY_POLICIES).map(capability => ({ capability, policy: capabilityPolicy(capability) })) }) }
export function capabilityCheck(req, res) { const decision = authorizeCapability(req.user.id, String(body(req).capability || req.query.capability || ''), { ...(req.user.activeContext || {}), ...(body(req).context || {}), mfaAssertion: req.get('x-mfa-assertion') }); auditCapabilityDecision(decision, req.user.id); return res.json(decision) }
export function activateRole(req, res) { return result(res, roleActivation(req.user.id, body(req).role, body(req).profile || {}), 201) }
export function switchRole(req, res) { return result(res, switchActiveRole(req.user.id, body(req).role)) }
export function roleAssignmentList(req, res) { return res.json(roleAssignments(req.user.id)) }
export function deactivateRole(req, res) { return result(res, deactivateRoleAssignment(req.user.id, req.params.role)) }
export function verificationStatus(req, res) { return res.json(getVerificationProfile(req.user.id, req.query.role)) }
export function verificationRequest(req, res) { return result(res, requestVerification(req.user.id, body(req)), 201) }
export function verificationEvidence(req, res) { return result(res, submitEvidence(req.user.id, req.params.requestId, body(req)), 201) }
export function trustProfile(req, res) { const db = readDb(); return res.json({ trust: trustProfileFor(req.user.id, req.query.role), risk: (db.riskProfiles || []).find(row => row.userId === req.user.id) || null }) }
export function organizationCreate(req, res) { return result(res, createOrganization(req.user.id, body(req)), 201) }
export function organizationClaim(req, res) { return result(res, claimOrganization(req.user.id, req.params.organizationId, body(req)), 201) }
export function organizationMembership(req, res) { return res.json({ memberships: organizationMemberships(req.user.id, req.params.organizationId) }) }
export function adminVerificationQueue(_req, res) { const db = readDb(); return res.json({ requests: db.verificationRequests || [], evidence: db.verificationEvidence || [], reviews: db.manualReviews || [] }) }
export function adminVerificationReview(req, res) { return result(res, reviewVerification(req.user.id, req.params.requestId, body(req))) }
export function adminCapabilityPolicies(_req, res) { return res.json({ policies: Object.keys(CAPABILITY_POLICIES).map(capability => ({ capability, policy: capabilityPolicy(capability) })) }) }
export function adminCapabilityPolicyUpdate(req, res) { return result(res, updateCapabilityPolicy(req.user.id, req.params.capability, body(req).policy || body(req))) }
export function organizationMemberAdd(req, res) { return result(res, addOrganizationMember(req.user.id, req.params.organizationId, body(req)), 201) }
export function adminRiskUpdate(req, res) { return result(res, updateRiskState(req.user.id, req.params.userId, body(req).state, body(req).note)) }
export function mfaEnroll(req, res) { return result(res, beginMfaEnrollment(req.user.id, req.user.email)) }
export function mfaVerify(req, res) { return result(res, verifyMfa(req.user.id, body(req).code, body(req).enable !== false)) }
export function mfaStatusGet(req, res) { return res.json(mfaStatus(req.user.id)) }
export function evidenceUploadUrl(req, res) { return result(res, createEvidenceUpload(req.user.id, req.params.requestId, body(req)), 201) }
export async function evidenceUploadFinalize(req, res) { return result(res, await finalizeEvidenceUpload(req.user.id, req.params.objectId)) }
export async function verificationEvidenceAnalyze(req, res) { return result(res, await analyzeEvidence(req.user.id, req.user.token, req.params.requestId, body(req))) }
export function adminVerificationAnalytics(_req, res) { return res.json(verificationAnalytics()) }
export function adminReverificationNotifications(_req, res) { return result(res, generateReverificationNotifications()) }
