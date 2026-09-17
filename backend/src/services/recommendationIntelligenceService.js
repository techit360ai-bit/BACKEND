import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { createId, nowIso, userName } from '../utils/api.js'
import { requireOrganizationPermission, organizationOverview, organizationPulse, organizationRisks } from './organizationIntelligenceService.js'
import { investorIntelligenceOverview } from './investorIntelligenceService.js'
import { publicTrustFor } from './trustVerificationAuthority.js'
import { evaluateEntitlement } from './tvceService.js'

const DAY = 86_400_000
const rows = (db, name) => Array.isArray(db[name]) ? db[name] : (db[name] = [])
const num = value => Number.isFinite(Number(value)) ? Number(value) : null
const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
const clean = value => String(value || '').trim()
const words = value => [...new Set((Array.isArray(value) ? value : [value]).flatMap(v => String(v || '').split(/[,|]/)).map(v => v.trim().toLowerCase()).filter(Boolean))]
const overlap = (left, right) => { const a = new Set(words(left)); const b = new Set(words(right)); if (!a.size || !b.size) return 0; let hits = 0; for (const item of a) if (b.has(item)) hits += 1; return hits / Math.min(a.size, b.size) }
const ageDays = value => { const time = new Date(value || 0).getTime(); return time ? Math.max(0, Math.floor((Date.now() - time) / DAY)) : null }
const latest = (items, fields = ['updatedAt', 'createdAt']) => [...items].sort((a, b) => new Date(fields.map(f => b[f]).find(Boolean) || 0) - new Date(fields.map(f => a[f]).find(Boolean) || 0))[0] || null
const profileFor = (db, id) => rows(db, 'profiles').find(row => String(row.id) === String(id)) || {}
const display = (profile, fallback = 'TechIT member') => userName(profile, fallback)

export function matchingAccess(userId, role = null) {
  const db = readAuthorityDb(); const profile = profileFor(db, userId); const normalizedRole = String(role || profile.activeRole || profile.role || 'founder').toLowerCase().replace('organisation', 'organization')
  const trust = publicTrustFor(userId, null, db); const subscription = rows(db, 'subscriptions').find(row => row.userId === userId && ['active', 'trialing', 'grace_period'].includes(row.status)); const ledgerCredits = rows(db, 'creditLedger').filter(row => row.userId === userId).reduce((sum, row) => sum + Number(row.deltaCredits ?? row.credits ?? 0), 0); const walletCredits = Number(rows(db, 'walletAccounts').find(row => row.userId === userId)?.creditBalance || 0); const credits = Math.max(ledgerCredits, walletCredits)
  const verificationTier = trust.tier || 'Claimed'; const verificationMultiplier = verificationTier === 'Highly Trusted' ? 2 : verificationTier === 'Verified' ? 1.6 : verificationTier === 'Building' ? 1.2 : 1
  const subscriptionMultiplier = subscription ? 2 : 1; const creditMultiplier = credits > 0 ? 1 + Math.min(1, credits / 100) : 1
  const matchLimit = Math.max(5, Math.min(100, Math.round(8 * verificationMultiplier * Math.max(subscriptionMultiplier, creditMultiplier))))
  const visibility = trust.verification_status === 'verified' ? (verificationTier === 'Highly Trusted' ? 'high-trust' : 'verified') : 'limited'
  const capability = normalizedRole === 'investor' ? 'INVESTOR_INTELLIGENCE' : normalizedRole === 'organization' ? 'ORGANIZATION_MONITORING' : normalizedRole === 'collaborator' ? 'ADVANCED_WORKSPACE_AI' : 'IDEA_DIAGNOSTICS_ADVANCED'
  const entitlement = evaluateEntitlement(userId, { capability, role: normalizedRole })
  return { ok: true, role: normalizedRole, matchLimit, visibility, verification: { tier: verificationTier, status: trust.verification_status, score: trust.trust_score, verifiedSkills: trust.verified_skill_count || 0 }, funding: { subscriptionActive: Boolean(subscription), plan: subscription?.planId || null, credits: Math.max(0, Math.round(credits)), capability: entitlement.capability, capabilityAllowed: entitlement.allowed, fundingSource: entitlement.funding || 'none' }, message: subscription ? 'Your subscription expands matching breadth and metered intelligence access.' : credits > 0 ? 'Purchased credits expand metered matching and intelligence access.' : 'Complete verification to improve trust visibility; add credits or a subscription for broader metered matching.' }
}

function executionSignals(db, userId) {
  const profile = profileFor(db, userId)
  const scoreRows = rows(db, 'executionScores').filter(row => [row.userId, row.collaboratorId, row.actorId].includes(userId))
  const tasks = rows(db, 'workspaceTasks').filter(row => [row.assigneeId, row.assignedTo, row.ownerId].includes(userId))
  const events = rows(db, 'recommendationEvents').filter(row => row.userId === userId || row.actorId === userId)
  const latestScore = latest(scoreRows)
  const delivery = num(latestScore?.deliveryReliability ?? latestScore?.deliveryRate ?? profile.deliveryReliability ?? profile.deliveryRate)
  const response = num(latestScore?.responseVelocity ?? latestScore?.responseScore ?? profile.responseVelocity)
  const execution = num(latestScore?.executionScore ?? latestScore?.score ?? profile.executionScore ?? profile.eviScore)
  const completed = tasks.filter(row => ['completed', 'done'].includes(String(row.status).toLowerCase())).length
  const taskRate = tasks.length ? completed / tasks.length * 100 : null
  const collaboration = events.filter(row => ['successful_collaboration', 'connect', 'message', 'apply', 'join'].includes(row.eventType)).length
  return { execution: execution ?? taskRate, delivery: delivery ?? taskRate, response: response ?? null, collaboration, tasks: tasks.length, completedTasks: completed }
}

function candidateProfile(db, row) {
  const profile = profileFor(db, row.id || row.userId || row.ownerId)
  return { ...profile, ...row, id: row.id || row.userId || row.ownerId, name: row.name || display(profile), skills: words([profile.skills, profile.subSkills, profile.techStack, row.skills]), industries: words([profile.industries, profile.investmentFocus, row.industries]), country: row.country || profile.country || '', title: row.title || profile.title || profile.discipline || profile.role || '' }
}

function rankCollaborator(viewer, candidate, need = {}) {
  const requiredSkills = words(need.requiredSkills || need.skills)
  const matchedSkills = requiredSkills.filter(skill => words(candidate.skills).some(item => item === skill || item.includes(skill) || skill.includes(item)))
  const skill = requiredSkills.length ? matchedSkills.length / requiredSkills.length * 100 : overlap(viewer.skills, candidate.skills) * 100
  const role = need.requestedRole && words([candidate.role, candidate.title, candidate.discipline]).some(item => item === clean(need.requestedRole).toLowerCase()) ? 100 : 0
  const execution = num(candidate.executionScore ?? candidate.execution ?? candidate.eviScore ?? candidate.evi_i)
  const delivery = num(candidate.deliveryReliability ?? candidate.deliveryRate)
  const response = num(candidate.responseVelocity ?? candidate.responseScore)
  const history = num(candidate.collaborationHistoryScore) ?? Math.min(100, Number(candidate.successfulCollaborations || 0) * 12)
  const geography = viewer.country && candidate.country && viewer.country.toLowerCase() === candidate.country.toLowerCase() ? 100 : 0
  const score = clamp(skill * 0.34 + role * 0.12 + (execution ?? 50) * 0.2 + (delivery ?? 50) * 0.12 + (response ?? 50) * 0.08 + history * 0.1 + geography * 0.04)
  const reasons = []
  if (matchedSkills.length) reasons.push(`Skills match: ${matchedSkills.slice(0, 4).join(', ')}`)
  if (execution !== null) reasons.push(`Execution score ${Math.round(execution)}`)
  if (delivery !== null) reasons.push(`Delivery reliability ${Math.round(delivery)}`)
  if (response !== null) reasons.push(`Response velocity ${Math.round(response)}`)
  if (history > 0) reasons.push(`${Math.round(history)} collaboration-history signal`)
  return { score, reasons: reasons.slice(0, 5), matchedSkills }
}

function collaboratorRows(db, excludeId) {
  return rows(db, 'profiles').filter(row => row.id !== excludeId && String(row.role || '').toLowerCase() === 'collaborator').map(row => candidateProfile(db, row))
}

export function collaboratorRecommendations(userId, input = {}) {
  const db = readAuthorityDb(); const viewer = candidateProfile(db, profileFor(db, userId)); const need = input; const access = matchingAccess(userId, viewer.role)
  const results = collaboratorRows(db, userId).map(candidate => ({ candidate, ...rankCollaborator(viewer, candidate, need) })).sort((a, b) => b.score - a.score).slice(0, Math.min(access.matchLimit, Number(input.limit || access.matchLimit)))
  return { ok: true, type: 'collaborator', access, recommendations: results.map((row, index) => ({ rank: index + 1, collaborator: { id: row.candidate.id, name: row.candidate.name, title: row.candidate.title, skills: row.candidate.skills, country: row.candidate.country }, score: row.score, reasons: row.reasons, matchedSkills: row.matchedSkills, evidence: { executionScore: num(row.candidate.executionScore ?? row.candidate.execution ?? row.candidate.eviScore), deliveryReliability: num(row.candidate.deliveryReliability ?? row.candidate.deliveryRate), responseVelocity: num(row.candidate.responseVelocity ?? row.candidate.responseScore), collaborationHistory: Number(row.candidate.successfulCollaborations || 0) }, deterministic: true })) }
}

export function founderCollaboratorRecommendations(userId, projectId, input = {}) {
  const db = readAuthorityDb(); const project = rows(db, 'projects').find(row => String(row.id) === String(projectId) && String(row.ownerId || row.founderId || row.createdBy) === String(userId))
  if (!project) return { ok: false, status: 404, error: 'project_not_found' }
  const teamIds = new Set(rows(db, 'workspaceMembers').filter(row => row.workspaceId === project.workspaceId && row.status === 'active').map(row => row.userId))
  const milestones = rows(db, 'milestones').filter(row => String(row.projectId || row.startupId) === String(projectId)); const overdue = milestones.filter(row => row.dueDate && new Date(row.dueDate).getTime() < Date.now() && !['completed', 'done', 'complete'].includes(String(row.status).toLowerCase())).length
  const lastActivity = latest([...rows(db, 'projectActivities'), ...rows(db, 'startupActivities')].filter(row => String(row.projectId || row.startupId) === String(projectId)))
  const stagnationDays = ageDays(lastActivity?.createdAt || project.updatedAt || project.createdAt) || 0
  const openRoles = words(input.openRoles || project.openRoles || project.requiredRoles)
  const requiredSkills = words(input.requiredSkills || project.requiredSkills || project.missingSkills || project.skills)
  const executionGap = Math.max(0, 70 - Number(project.executionScore ?? project.executionVelocity ?? project.eviScore ?? 0))
  const need = { requestedRole: input.requestedRole || openRoles[0], requiredSkills, stagnationDays }
  const base = collaboratorRecommendations(userId, { ...need, limit: 50 }).recommendations
  return { ok: true, type: 'founder_collaborator', projectId: String(projectId), access: matchingAccess(userId, 'founder'), context: { stage: project.stage || null, stagnationDays, openRoles, missingSkills: requiredSkills, overdueMilestones: overdue, executionGap }, recommendations: base.map(item => ({ ...item, score: clamp(item.score + Math.min(15, stagnationDays / 3) + Math.min(10, overdue * 3) + Math.min(10, executionGap / 7),), reasons: [...item.reasons, ...(stagnationDays >= 14 ? [`Priority raised: ${stagnationDays} days without meaningful progress`] : []), ...(overdue ? [`${overdue} milestone risk${overdue === 1 ? '' : 's'}`] : []), ...(executionGap ? [`Execution gap ${Math.round(executionGap)} points`] : [])].slice(0, 6) })) }
}

function organizationNeeds(db, organizationId, input = {}) {
  const projects = rows(db, 'projects').filter(row => row.organizationId === organizationId); const members = rows(db, 'organizationMemberships').filter(row => row.organizationId === organizationId && row.status === 'active')
  const required = words([input.requiredSkills, input.skills, ...projects.map(row => row.requiredSkills || row.missingSkills || row.openRoles)])
  const openRoles = words([input.openRoles, ...projects.map(row => row.openRoles || row.requiredRoles)])
  const gaps = projects.flatMap(project => words(project.missingSkills || project.requiredSkills || project.openRoles).map(skill => ({ skill, projectId: project.id, stage: project.stage || null })))
  return { required, openRoles, gaps, stages: [...new Set(projects.map(row => row.stage).filter(Boolean))], memberCount: members.length }
}

export function organizationTalentRecommendations(userId, input = {}) {
  const context = requireOrganizationPermission(userId, 'view', input.organizationId); if (!context.ok) return context
  const db = readAuthorityDb(); const needs = organizationNeeds(db, context.organizationId, input); const rowsOut = rows(db, 'profiles').filter(row => row.id !== userId && ['collaborator', 'founder', 'investor'].includes(String(row.role || '').toLowerCase())).map(row => candidateProfile(db, row))
  const recommendations = rowsOut.map(candidate => { const skill = overlap(needs.required, candidate.skills) * 100; const role = needs.openRoles.some(item => words([candidate.title, candidate.role]).some(term => term === item)) ? 100 : 0; const industry = overlap(candidate.industries, rows(db, 'projects').filter(p => p.organizationId === context.organizationId).map(p => p.industry)) * 100; const signals = executionSignals(db, candidate.id); const score = clamp(skill * 0.4 + role * 0.15 + industry * 0.1 + (signals.execution ?? 50) * 0.15 + (signals.delivery ?? 50) * 0.1 + Math.min(100, signals.collaboration * 10) * 0.1); const reasons = []; if (skill) reasons.push(`Need coverage ${Math.round(skill)}%`); if (role) reasons.push('Open-role alignment'); if (industry) reasons.push('Organization industry alignment'); if (signals.execution !== null) reasons.push(`Execution ${Math.round(signals.execution)}`); return { candidate, score, reasons: reasons.slice(0, 5), signals } }).sort((a, b) => b.score - a.score).slice(0, Math.min(50, Number(input.limit || 20)))
  return { ok: true, organizationId: context.organizationId, access: matchingAccess(userId, 'organization'), needs, recommendations: recommendations.map((row, index) => ({ rank: index + 1, person: { id: row.candidate.id, name: row.candidate.name, role: row.candidate.role, title: row.candidate.title, skills: row.candidate.skills, country: row.candidate.country }, score: row.score, reasons: row.reasons, execution: row.signals, deterministic: true })) }
}

export function mentorRecommendations(userId, input = {}) {
  const db = readAuthorityDb(); const mentor = profileFor(db, userId); const expertise = words([mentor.skills, mentor.subSkills, mentor.techStack, mentor.industries, input.expertise]); const rooms = rows(db, 'mentorshipRooms').filter(row => row.mentorId === userId); const activeCapacity = rooms.reduce((sum, room) => sum + rows(db, 'mentorshipMentees').filter(m => m.roomId === room.id && m.status === 'active').length, 0); const capacity = rooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0); const candidates = rows(db, 'projects').map(project => { const ownerId = project.ownerId || project.founderId || project.createdBy; const owner = profileFor(db, ownerId); const activity = latest([...rows(db, 'projectActivities'), ...rows(db, 'startupActivities')].filter(row => String(row.projectId || row.startupId) === String(project.id))); const stagnationDays = ageDays(activity?.createdAt || project.updatedAt || project.createdAt) || 0; const gapSkills = words(project.missingSkills || project.requiredSkills || project.openRoles); const stageMatch = input.stage ? String(project.stage || '').toLowerCase() === String(input.stage).toLowerCase() ? 100 : 0 : 50; const skillMatch = overlap(expertise, gapSkills) * 100; const prior = rows(db, 'mentorshipApplications').filter(row => row.applicantId === ownerId).length + rows(db, 'mentorshipMentees').filter(row => row.userId === ownerId && row.status === 'completed').length * 2; const need = Math.min(100, stagnationDays * 4) + Math.min(30, gapSkills.length * 6); const score = clamp(skillMatch * 0.32 + stageMatch * 0.12 + Math.min(100, need) * 0.26 + Math.min(100, prior * 10) * 0.1 + (capacity > activeCapacity ? 100 : 0) * 0.1 + (project.status === 'active' ? 10 : 0) * 0.1); return { project, owner, score, stagnationDays, gapSkills, skillMatch, prior } }).filter(row => row.owner.id && row.owner.id !== userId).sort((a, b) => b.score - a.score).slice(0, Math.min(50, Number(input.limit || 20)))
  const access = matchingAccess(userId, 'mentor'); return { ok: true, mentorId: userId, access, capacity: { active: activeCapacity, limit: capacity || null, remaining: capacity ? Math.max(0, capacity - activeCapacity) : null }, recommendations: candidates.slice(0, access.matchLimit).map((row, index) => ({ rank: index + 1, startup: { id: row.project.id, name: row.project.title || row.project.name || row.project.id, stage: row.project.stage || null, ownerId: row.owner.id, ownerName: display(row.owner), skills: row.gapSkills }, score: row.score, reasons: [row.skillMatch ? `Expertise covers ${Math.round(row.skillMatch)}% of identified gaps` : 'Relevant startup need', row.stagnationDays >= 14 ? `${row.stagnationDays} days stagnation risk` : 'Recent progress signal', row.project.stage ? `Stage: ${row.project.stage}` : null, row.prior ? `${row.prior} prior mentorship outcome signal` : null].filter(Boolean).slice(0, 5), evidence: { stagnationDays: row.stagnationDays, skillGaps: row.gapSkills, priorOutcomes: row.prior }, deterministic: true })) }
}

export function investorThesisRecommendations(userId, input = {}) {
  const db = readAuthorityDb(); const investor = profileFor(db, userId); const focus = words(input.industries || input.sectors || investor.investmentFocus || investor.industries); const geography = words(input.geography || input.geographies || investor.preferredGeographies || investor.country); const stages = words(input.stages || input.stagePreference || investor.stagePreference); const minTicket = num(input.minTicket || investor.minCheckSize); const maxTicket = num(input.maxTicket || investor.maxCheckSize); const risk = clean(input.riskTolerance || investor.riskTolerance).toLowerCase(); const history = rows(db, 'investments').filter(row => [row.investorId, row.userId, row.ownerId].includes(userId)); const watched = rows(db, 'investorWatchlists').filter(row => row.investorId === userId).map(row => row.projectId)
  const snapshots = rows(db, 'dealFlowSnapshots').filter(row => row.visibility === 'public' || row.investorId === userId); const projects = rows(db, 'projects'); const recommendations = snapshots.map(snapshot => { const project = projects.find(row => row.id === (snapshot.projectId || snapshot.startupId)) || {}; const sector = words(project.industry || snapshot.industry || snapshot.sector); const region = words(project.country || project.region || snapshot.region); const stage = words(project.stage || snapshot.stage); const ticket = num(snapshot.checkSize || snapshot.ticketSize || project.checkSize); const sectorScore = overlap(focus, sector) * 100; const geoScore = overlap(geography, region) * 100; const stageScore = overlap(stages, stage) * 100; const ticketScore = minTicket === null && maxTicket === null ? 50 : ticket !== null && (minTicket === null || ticket >= minTicket) && (maxTicket === null || ticket <= maxTicket) ? 100 : 0; const riskScore = risk ? (risk === String(snapshot.riskLevel || project.riskLevel || '').toLowerCase() ? 100 : 50) : 50; const behaviorScore = watched.includes(project.id) ? 100 : history.some(row => row.projectId === project.id) ? 100 : 0; const execution = num(snapshot.executionVelocity || snapshot.eviI || project.executionVelocity || project.eviScore) ?? 50; const score = clamp(sectorScore * 0.24 + geoScore * 0.12 + stageScore * 0.14 + ticketScore * 0.12 + riskScore * 0.08 + behaviorScore * 0.1 + execution * 0.2); return { project, snapshot, score, sectorScore, geoScore, stageScore, ticketScore, behaviorScore, execution } }).filter(row => row.project.id || row.snapshot.projectId).sort((a, b) => b.score - a.score).slice(0, Math.min(100, Number(input.limit || 30)))
  return { ok: true, investorId: userId, access: matchingAccess(userId, 'investor'), thesis: { industries: focus, geographies: geography, stages, minTicket, maxTicket, riskTolerance: risk || null }, recommendations: recommendations.map((row, index) => ({ rank: index + 1, startup: { id: row.project.id || row.snapshot.projectId, name: row.project.title || row.snapshot.startupName || row.snapshot.name || row.snapshot.projectId, sector: row.project.industry || row.snapshot.industry || row.snapshot.sector || null, geography: row.project.country || row.project.region || row.snapshot.region || null, stage: row.project.stage || row.snapshot.stage || null, execution: row.execution }, score: row.score, reasons: [row.sectorScore >= 50 ? 'Sector matches thesis' : null, row.geoScore >= 50 ? 'Geography matches thesis' : null, row.stageScore >= 50 ? 'Stage matches thesis' : null, row.ticketScore === 100 ? 'Ticket size fits' : null, row.behaviorScore ? 'Aligned with your historical interest' : null, `Execution signal ${Math.round(row.execution)}`].filter(Boolean).slice(0, 6), deterministic: true })) }
}

function founderDigest(db, userId) {
  const projects = rows(db, 'projects').filter(row => [row.ownerId, row.founderId, row.createdBy].includes(userId)); const signals = projects.map(project => ({ id: project.id, title: project.title || project.name || project.id, stage: project.stage || null, progress: num(project.progress), execution: num(project.executionScore || project.executionVelocity || project.eviScore), stagnationDays: ageDays(project.updatedAt || project.createdAt) || 0, openRoles: words(project.openRoles || project.requiredRoles), missingSkills: words(project.missingSkills || project.requiredSkills) })); return { stage: signals[0]?.stage || null, progress: signals, risks: signals.filter(row => row.stagnationDays >= 14 || (row.progress !== null && row.progress < 35)).map(row => ({ type: 'stagnation', projectId: row.id, days: row.stagnationDays })), opportunities: signals.flatMap(row => row.openRoles.map(role => ({ type: 'collaborator', role, projectId: row.id }))), recommendations: signals.map(row => ({ action: row.stagnationDays >= 14 ? 're-engage execution' : row.missingSkills.length ? 'find targeted collaborator' : 'ship next milestone', projectId: row.id })) }
}

function collaboratorDigest(db, userId) { const signals = executionSignals(db, userId); return { stage: profileFor(db, userId).stage || null, progress: signals, risks: signals.execution !== null && signals.execution < 35 ? [{ type: 'execution', score: signals.execution }] : [], opportunities: [{ type: 'project', action: 'review skill-matched opportunities' }], recommendations: [{ action: signals.execution !== null && signals.execution < 35 ? 'complete the smallest assigned task' : 'take the next high-value task' }] } }

export function continuousIntelligence(userId, input = {}) {
  const db = readAuthorityDb(); const profile = profileFor(db, userId); const role = String(input.role || profile.activeRole || profile.role || 'explorer').toLowerCase().replace('organisation', 'organization'); let digest
  if (role === 'founder') digest = founderDigest(db, userId)
  else if (role === 'collaborator') digest = collaboratorDigest(db, userId)
  else if (role === 'investor') { const result = investorIntelligenceOverview(userId); digest = { stage: null, progress: result.startups.map(row => ({ startupId: row.startupId, execution: row.executionVelocity, readiness: row.readiness, risk: row.riskLevel })), risks: result.startups.filter(row => ['moderate', 'high'].includes(row.riskLevel)).map(row => ({ type: 'startup_risk', startupId: row.startupId, level: row.riskLevel, evidence: row.evidence })), opportunities: result.startups.filter(row => row.riskLevel === 'low').map(row => ({ type: 'startup', startupId: row.startupId })), recommendations: result.startups.slice(0, 5).map(row => ({ action: row.riskLevel === 'high' ? 'review authorized evidence' : 'monitor next milestone', startupId: row.startupId })) } }
  else if (role === 'organization') { const organizationId = input.organizationId || rows(db, 'organizationMemberships').find(row => row.userId === userId && row.status === 'active')?.organizationId; const overview = organizationOverview(userId, organizationId); const pulse = organizationPulse(userId, { organizationId, window: input.window || '7d' }); const risks = organizationRisks(userId, { organizationId }); digest = { stage: null, progress: overview.ok ? overview.health : null, risks: risks.risks || [], opportunities: overview.ok ? [{ type: 'talent', action: 'review organization talent matches' }] : [], recommendations: pulse.activity?.slice(0, 5).map(row => ({ action: row.message })) || [] } }
  else digest = { stage: null, progress: null, risks: [], opportunities: [], recommendations: [{ action: 'complete profile to improve recommendations' }] }
  const snapshot = { id: createId('continuous_intelligence'), userId, role, activeContext: input.activeContext || null, date: new Date().toISOString().slice(0, 10), asOf: nowIso(), cadence: 'daily', ...digest, deterministic: true }
  updateAuthorityDb(state => { rows(state, 'continuousIntelligenceSnapshots').push(snapshot); if (state.continuousIntelligenceSnapshots.length > 10000) state.continuousIntelligenceSnapshots.splice(0, state.continuousIntelligenceSnapshots.length - 10000); return snapshot })
  return { ok: true, intelligence: snapshot }
}
