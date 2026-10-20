import { readAuthorityDb } from '../config/database.js'
import { cofounderModeEnabled } from '../config/runtimeConfig.js'
import { runCofounderRead } from '../repositories/cofounderRepository.js'
import { COFOUNDER_STATUSES, PRE_ACTIVE_STATUSES, profileName, rows, textList } from './cofounderModel.js'

export const COFOUNDER_FIT_POLICY = Object.freeze({
  version: 'cofounder-fit-v1',
  weights: Object.freeze({
    capabilityFit: 0.22,
    skillComplementarity: 0.12,
    ventureStageFit: 0.10,
    commitmentCompatibility: 0.12,
    experience: 0.08,
    visionAlignment: 0.08,
    workingStyleCompatibility: 0.05,
    riskCompatibility: 0.04,
    geographicTimeCompatibility: 0.04,
    executionReputation: 0.07,
    trustVerification: 0.05,
    industryDomainFit: 0.03,
  }),
})

const DIMENSION_LABELS = Object.freeze({
  capabilityFit: 'Capability fit',
  skillComplementarity: 'Skill complementarity',
  ventureStageFit: 'Venture-stage fit',
  commitmentCompatibility: 'Commitment compatibility',
  experience: 'Experience',
  visionAlignment: 'Vision alignment',
  workingStyleCompatibility: 'Working-style compatibility',
  riskCompatibility: 'Risk compatibility',
  geographicTimeCompatibility: 'Geographic/time compatibility',
  executionReputation: 'Execution reputation',
  trustVerification: 'Trust and verification',
  industryDomainFit: 'Industry/domain fit',
})

function tokens(value) {
  const input = Array.isArray(value) ? value : [value]
  return [...new Set(input.flatMap(item => String(item || '').toLowerCase().split(/[^a-z0-9+#.]+/)).filter(token => token.length > 1))]
}

function bounded(value, min = 0, max = 100) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null
}

function overlapScore(left, right) {
  const a = new Set(tokens(left))
  const b = new Set(tokens(right))
  if (!a.size || !b.size) return null
  let matches = 0
  for (const value of a) if (b.has(value)) matches += 1
  return (matches / a.size) * 100
}

function scalarAlignment(left, right) {
  const a = tokens(left)
  const b = tokens(right)
  if (!a.length || !b.length) return null
  const matched = a.filter(value => b.includes(value)).length
  return (matched / Math.max(a.length, b.length)) * 100
}

function profileFor(db, userId) {
  return rows(db, 'profiles').find(row => String(row.id) === String(userId)) || null
}

function latestFor(db, collection, userId) {
  return rows(db, collection)
    .filter(row => [row.userId, row.collaboratorId, row.actorId].includes(userId))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] || null
}

function candidateSkillList(profile) {
  return textList([
    ...(Array.isArray(profile?.skills) ? profile.skills : []),
    ...(Array.isArray(profile?.subSkills) ? profile.subSkills : []),
    ...(Array.isArray(profile?.techStack) ? profile.techStack : []),
  ], 80, 80)
}

function requirementFor(db, userId, projectId, input) {
  const requirements = rows(db, 'cofounderRequirements')
    .filter(row => String(row.projectId) === String(projectId) && String(row.founderId) === String(userId) && row.status !== 'archived')
  if (input.requirementId) return requirements.find(row => String(row.id) === String(input.requirementId)) || null
  return requirements.sort((a, b) => Number(b.version || 1) - Number(a.version || 1))[0] || null
}

function scoreDimension(value, weight, evidence, missingReason) {
  const normalized = value == null ? null : Math.round(Math.max(0, Math.min(100, value)) * 10) / 10
  return {
    value: normalized,
    weight,
    confidence: normalized == null ? 0 : 1,
    evidence,
    ...(normalized == null ? { missingEvidence: missingReason } : {}),
  }
}

function candidateTrust(db, candidateId) {
  const profile = latestFor(db, 'trustProfiles', candidateId)
  const skills = rows(db, 'verifiedSkills').filter(row => row.userId === candidateId && row.status === 'verified')
  const proofs = rows(db, 'trustVerificationProofs').filter(row => row.userId === candidateId && row.status === 'verified')
  const score = bounded(profile?.trustScore ?? profile?.trust_score)
  if (score == null && !skills.length && !proofs.length) {
    return { score: null, skills: [], proofs: [], missingEvidence: 'No canonical Trust Engine profile or verified proof is available.' }
  }
  return {
    score: score ?? 0,
    skills: skills.map(row => ({ skill: row.skill, source: row.source, confidence: row.confidence, verifiedAt: row.updatedAt })),
    proofs: proofs.map(row => ({ source: row.source, status: row.status, verifiedAt: row.updatedAt })),
  }
}

function candidateExecution(db, candidateId) {
  const profile = profileFor(db, candidateId)
  const score = latestFor(db, 'executionScores', candidateId)
  const value = bounded(score?.executionScore ?? score?.score ?? profile?.executionScore ?? profile?.eviScore)
  return {
    value,
    deliveryReliability: bounded(score?.deliveryReliability ?? score?.deliveryRate ?? profile?.deliveryReliability),
    completedTasks: Number(score?.completedTasks || 0),
    missingEvidence: value == null ? 'No TechIT execution or delivery signal is available.' : null,
  }
}

function candidateCompatibility(profile) {
  return profile?.cofounderPreferences && typeof profile.cofounderPreferences === 'object'
    ? profile.cofounderPreferences
    : profile?.compatibility && typeof profile.compatibility === 'object' ? profile.compatibility : {}
}

function evaluateCandidate({ db, founder, project, requirement, candidate }) {
  const candidateProfile = profileFor(db, candidate.id)
  const requestedSkills = textList(requirement.requiredSkills, 80, 80)
  const candidateSkills = candidateSkillList(candidateProfile)
  const founderSkills = candidateSkillList(founder)
  const compatibility = candidateCompatibility(candidateProfile)
  const founderCompatibility = requirement.compatibility || {}
  const projectIndustry = tokens(project?.industry || project?.sector || project?.industries)
  const candidateIndustries = tokens(candidateProfile?.industries)
  const requiredHours = bounded(requirement.commitment?.hoursPerWeek, 0, 168)
  const candidateHours = bounded(candidateProfile?.weeklyHours ?? candidateProfile?.availability?.hoursPerWeek ?? candidateProfile?.hoursPerWeek, 0, 168)
  const requiredExperience = bounded(requirement.experience?.years)
  const candidateExperience = bounded(candidateProfile?.yearsExperience ?? candidateProfile?.experienceYears)
  const trust = candidateTrust(db, candidate.id)
  const execution = candidateExecution(db, candidate.id)
  const candidateStages = tokens(candidateProfile?.stageExperience || candidateProfile?.startupStages || candidateProfile?.ventureStages)
  const founderTimezone = founder?.timezone || founder?.utcOffset || founder?.country
  const candidateTimezone = candidateProfile?.timezone || candidateProfile?.utcOffset || candidateProfile?.country

  const capability = requestedSkills.length
    ? (requestedSkills.filter(skill => candidateSkills.some(value => value.toLowerCase() === skill.toLowerCase())).length / requestedSkills.length) * 100
    : null
  let complementarity = null
  if (founderSkills.length && candidateSkills.length) {
    const founderSet = new Set(founderSkills.map(value => value.toLowerCase()))
    const candidateSet = new Set(candidateSkills.map(value => value.toLowerCase()))
    const uniqueCandidate = [...candidateSet].filter(value => !founderSet.has(value)).length
    const union = new Set([...founderSet, ...candidateSet]).size
    complementarity = (uniqueCandidate / Math.max(1, union)) * 100
  }
  const stageFit = candidateStages.length && requirement.ventureStage
    ? (candidateStages.includes(String(requirement.ventureStage).toLowerCase()) ? 100 : 0)
    : null
  let commitmentFit = null
  if (requiredHours != null && candidateHours != null) {
    commitmentFit = Math.min(100, (candidateHours / Math.max(1, requiredHours)) * 100)
  } else if (requirement.commitment?.type && compatibility.commitment) {
    commitmentFit = String(requirement.commitment.type) === String(compatibility.commitment) ? 100 : 0
  }
  const experienceFit = requiredExperience != null && candidateExperience != null
    ? Math.min(100, (candidateExperience / Math.max(1, requiredExperience)) * 100)
    : null
  const vision = scalarAlignment(founderCompatibility.visionAnswers || founderCompatibility.vision, compatibility.visionAnswers || compatibility.vision)
  const workingStyle = scalarAlignment(founderCompatibility.workingStyle, compatibility.workingStyle)
  const risk = scalarAlignment(founderCompatibility.riskTolerance, compatibility.riskTolerance)
  const geo = founderTimezone && candidateTimezone
    ? String(founderTimezone).toLowerCase() === String(candidateTimezone).toLowerCase() ? 100
      : String(founder?.country || '').toLowerCase() === String(candidateProfile?.country || '').toLowerCase() ? 80 : 40
    : null
  const industryFit = projectIndustry.length && candidateIndustries.length
    ? (projectIndustry.filter(value => candidateIndustries.includes(value)).length / projectIndustry.length) * 100
    : null

  const dimensions = {
    capabilityFit: scoreDimension(capability, COFOUNDER_FIT_POLICY.weights.capabilityFit, { requiredSkills, candidateSkills }, 'The requirement has no skills or the candidate profile has no usable skills.'),
    skillComplementarity: scoreDimension(complementarity, COFOUNDER_FIT_POLICY.weights.skillComplementarity, { founderSkills, candidateSkills }, 'Both founder and candidate skill sets are required to measure complementarity.'),
    ventureStageFit: scoreDimension(stageFit, COFOUNDER_FIT_POLICY.weights.ventureStageFit, { requiredStage: requirement.ventureStage || null, candidateStages }, 'Candidate venture-stage experience is not available.'),
    commitmentCompatibility: scoreDimension(commitmentFit, COFOUNDER_FIT_POLICY.weights.commitmentCompatibility, { requiredHours, candidateHours, requiredType: requirement.commitment?.type || null, candidateType: compatibility.commitment || null }, 'Commitment requirements or candidate availability are missing.'),
    experience: scoreDimension(experienceFit, COFOUNDER_FIT_POLICY.weights.experience, { requiredYears: requiredExperience, candidateYears: candidateExperience }, 'Required or candidate experience data is missing.'),
    visionAlignment: scoreDimension(vision, COFOUNDER_FIT_POLICY.weights.visionAlignment, { founderAnswers: founderCompatibility.visionAnswers || founderCompatibility.vision || null, candidateAnswers: compatibility.visionAnswers || compatibility.vision || null }, 'Both parties must provide explicit vision answers.'),
    workingStyleCompatibility: scoreDimension(workingStyle, COFOUNDER_FIT_POLICY.weights.workingStyleCompatibility, { founder: founderCompatibility.workingStyle || null, candidate: compatibility.workingStyle || null }, 'Both parties must provide an explicit working-style preference.'),
    riskCompatibility: scoreDimension(risk, COFOUNDER_FIT_POLICY.weights.riskCompatibility, { founder: founderCompatibility.riskTolerance || null, candidate: compatibility.riskTolerance || null }, 'Both parties must provide an explicit risk preference.'),
    geographicTimeCompatibility: scoreDimension(geo, COFOUNDER_FIT_POLICY.weights.geographicTimeCompatibility, { founder: founderTimezone || null, candidate: candidateTimezone || null }, 'Timezone or geography is missing.'),
    executionReputation: scoreDimension(execution.value, COFOUNDER_FIT_POLICY.weights.executionReputation, execution, execution.missingEvidence),
    trustVerification: scoreDimension(trust.score, COFOUNDER_FIT_POLICY.weights.trustVerification, { trustScore: trust.score, verifiedSkills: trust.skills, proofs: trust.proofs }, trust.missingEvidence),
    industryDomainFit: scoreDimension(industryFit, COFOUNDER_FIT_POLICY.weights.industryDomainFit, { projectIndustry: [...projectIndustry], candidateIndustries: [...candidateIndustries] }, 'Project industry or candidate industry data is missing.'),
  }
  let weightedTotal = 0
  let availableWeight = 0
  let evidenceCount = 0
  for (const dimension of Object.values(dimensions)) {
    if (dimension.value == null) continue
    weightedTotal += dimension.value * dimension.weight
    availableWeight += dimension.weight
    evidenceCount += 1
  }
  const fit = availableWeight ? weightedTotal / availableWeight : null
  const confidence = Math.round((availableWeight + Math.min(0.15, evidenceCount * 0.0125)) * 1000) / 1000
  const strengths = Object.entries(dimensions)
    .filter(([, dimension]) => dimension.value != null && dimension.value >= 70)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([key, dimension]) => ({ dimension: key, label: DIMENSION_LABELS[key], score: dimension.value }))
  const concerns = []
  for (const [key, dimension] of Object.entries(dimensions)) {
    if (dimension.value != null && dimension.value < 50 && ['commitmentCompatibility', 'ventureStageFit', 'geographicTimeCompatibility', 'trustVerification'].includes(key)) {
      concerns.push({ dimension: key, label: DIMENSION_LABELS[key], score: dimension.value, reason: `${DIMENSION_LABELS[key]} is below the matching threshold.` })
    }
  }
  const missingEvidence = Object.entries(dimensions)
    .filter(([, dimension]) => dimension.value == null)
    .map(([key, dimension]) => ({ dimension: key, label: DIMENSION_LABELS[key], reason: dimension.missingEvidence }))
  return {
    fit: fit == null ? null : Math.round(fit * 10) / 10,
    confidence: Math.min(1, confidence),
    dimensions,
    strengths: strengths.slice(0, 5),
    concerns: concerns.slice(0, 4),
    missingEvidence,
    claimed: {
      title: candidateProfile?.title || candidateProfile?.discipline || '',
      skills: candidateSkills,
      industries: textList(candidateProfile?.industries, 20, 80),
      experienceYears: candidateExperience,
      availabilityHours: candidateHours,
    },
    verified: {
      trustScore: trust.score,
      tier: latestFor(db, 'trustProfiles', candidate.id)?.tier || null,
      verifiedSkills: trust.skills,
      proofs: trust.proofs,
    },
    observed: {
      executionScore: execution.value,
      deliveryReliability: execution.deliveryReliability,
      completedTasks: execution.completedTasks,
    },
  }
}

function matchLabel(fit) {
  if (fit == null) return 'Insufficient evidence'
  if (fit >= 80) return 'Strong match'
  if (fit >= 65) return 'Good match'
  if (fit >= 50) return 'Potential match'
  return 'Low evidence fit'
}

export function cofounderRecommendationsInDb(db, userId, projectId, input = {}, access = null) {
  if (!cofounderModeEnabled(userId)) return { ok: false, status: 404, error: 'cofounder_mode_disabled' }
  const project = rows(db, 'projects').find(row => String(row.id) === String(projectId))
  if (!project) return { ok: false, status: 404, error: 'project_not_found' }
  const ownerId = project.ownerId || project.founderId || project.createdBy
  if (String(ownerId || '') !== String(userId)) return { ok: false, status: 404, error: 'project_not_found' }
  const requirement = requirementFor(db, userId, projectId, input)
  if (!requirement) return { ok: false, status: 400, error: 'cofounder_requirement_required' }
  if (input.requirementVersion != null && Number(input.requirementVersion) !== Number(requirement.version || 1)) {
    return { ok: false, status: 409, error: 'cofounder_requirement_version_conflict', currentVersion: requirement.version }
  }
  const founder = profileFor(db, userId)
  const existingCandidateIds = new Set(rows(db, 'cofounderRelationships')
    .filter(row => String(row.projectId) === String(projectId) && String(row.founderId) === String(userId) && !['DECLINED', 'WITHDRAWN', 'ENDED'].includes(row.status))
    .map(row => String(row.cofounderId)))
  const candidateInput = input.candidateIds || input.candidateId
  const requestedCandidates = new Set(textList(Array.isArray(candidateInput) ? candidateInput : [candidateInput], 50, 120))
  const candidates = rows(db, 'profiles')
    .filter(row => String(row.id) !== String(userId))
    .filter(row => !['investor', 'investor_team', 'organization', 'organisation'].includes(String(row.role || '').toLowerCase()))
    .filter(row => !existingCandidateIds.has(String(row.id)))
    .filter(row => !requestedCandidates.size || requestedCandidates.has(String(row.id)))
    .filter(row => row.active !== false && row.accountStatus !== 'disabled')
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const limit = Math.max(1, Math.min(50, Number(input.limit || access?.matchLimit || 20)))
  const scored = candidates.map(candidate => {
    const evaluation = evaluateCandidate({ db, founder, project, requirement, candidate })
    return {
      candidate,
      ...evaluation,
    }
  }).sort((a, b) => {
    const aFit = a.fit ?? -1
    const bFit = b.fit ?? -1
    return bFit - aFit || b.confidence - a.confidence || String(a.candidate.id).localeCompare(String(b.candidate.id))
  }).slice(0, limit)
  const recommendations = scored.map((row, index) => ({
    rank: index + 1,
    candidate: {
      id: row.candidate.id,
      name: profileName(row.candidate),
      title: row.candidate.title || row.candidate.discipline || requirement.roleTitle || '',
      avatarUrl: row.candidate.avatarUrl || '',
      country: row.candidate.country || '',
      timezone: row.candidate.timezone || '',
    },
    collaborator: {
      id: row.candidate.id,
      name: profileName(row.candidate),
      title: row.candidate.title || row.candidate.discipline || requirement.roleTitle || '',
      skills: row.claimed.skills,
      country: row.candidate.country || '',
    },
    score: row.fit == null ? 0 : Math.round(row.fit),
    cofounderFit: row.fit == null ? null : Math.round(row.fit),
    confidence: row.confidence,
    label: matchLabel(row.fit),
    breakdown: row.dimensions,
    strengths: row.strengths,
    concerns: row.concerns,
    missingEvidence: row.missingEvidence,
    claimed: row.claimed,
    verified: row.verified,
    observed: row.observed,
    reasons: row.strengths.slice(0, 4).map(item => `${item.label}: ${Math.round(item.score)}%`),
    deterministic: true,
    policyVersion: COFOUNDER_FIT_POLICY.version,
  }))
  const recommended = recommendations[0] || null
  return {
    ok: true,
    type: 'cofounder',
    relationshipType: 'co_founder',
    projectId: String(projectId),
    requirementId: requirement.id,
    requirementVersion: Number(requirement.version || 1),
    access: access || { role: 'founder', matchLimit: limit },
    context: {
      roleType: requirement.roleType,
      roleTitle: requirement.roleTitle || null,
      ventureStage: requirement.ventureStage || project.stage || null,
      requiredSkills: requirement.requiredSkills || [],
      commitment: requirement.commitment || {},
    },
    policy: { version: COFOUNDER_FIT_POLICY.version, weights: COFOUNDER_FIT_POLICY.weights },
    recommendations,
    recommendedCandidate: recommended ? {
      id: recommended.candidate.id,
      name: recommended.candidate.name,
      score: recommended.cofounderFit,
      confidence: recommended.confidence,
      explanation: recommended.strengths.length
        ? `Highest deterministic fit, led by ${recommended.strengths.slice(0, 3).map(item => item.label.toLowerCase()).join(', ')}.`
        : 'Highest deterministic fit among candidates with available evidence.',
      missingEvidence: recommended.missingEvidence,
    } : null,
    meta: {
      totalCandidates: candidates.length,
      returned: recommendations.length,
      generatedAt: new Date().toISOString(),
      deterministic: true,
      aiEnrichment: false,
      policyVersion: COFOUNDER_FIT_POLICY.version,
    },
  }
}

export function cofounderRecommendations(userId, projectId, input = {}, access = null) {
  return cofounderRecommendationsInDb(readAuthorityDb(), userId, projectId, input, access)
}

export async function cofounderRecommendationsAsync(userId, projectId, input = {}, access = null) {
  if (!cofounderModeEnabled(userId)) return { ok: false, status: 404, error: 'cofounder_mode_disabled' }
  return runCofounderRead(userId, { projectId, discovery: true }, () => cofounderRecommendations(userId, projectId, input, access))
}

export function cofounderComparison(result, candidateIds = []) {
  if (!result?.ok) return result
  const ids = new Set((Array.isArray(candidateIds) ? candidateIds : []).map(String))
  const recommendations = result.recommendations.filter(row => !ids.size || ids.has(String(row.candidate.id)))
  return {
    ok: true,
    relationshipType: 'co_founder',
    policyVersion: result.policy.version,
    candidates: recommendations,
    recommendedCandidateId: result.recommendedCandidate?.id || null,
    deterministic: true,
  }
}

export function isCofounderRelationshipType(value) {
  return ['co_founder', 'cofounder', 'co-founder'].includes(String(value || '').toLowerCase())
}

export function isCofounderStatusActive(status) {
  return status === COFOUNDER_STATUSES.ACTIVE
}

export function isPreActive(status) {
  return PRE_ACTIVE_STATUSES.includes(status)
}
