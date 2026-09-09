import { createOrganizationActionAsync, createOrganizationCohort, createOrganizationPartner, createOrganizationResource, createReportSchedule, generateOrganizationReport, listOrganizationActionsAsync, listOrganizationCollectionAsync, listOrganizationKpisAsync, organizationActivity, organizationAlumniOutcomes, organizationAuditEvents, organizationBriefingEvidence, organizationCohortBenchmarks, organizationMembers, organizationOverview, organizationProgramHealth, organizationPulse, organizationRecommendations, organizationResourceAllocation, organizationRisks, organizationStartupPortfolio, refreshOrganizationIntelligence, saveOrganizationKpiAsync, updateOrganizationActionAsync, updateOrganizationMember, verifyOrganizationAudit } from '../services/organizationIntelligenceService.js'
import { requestOrganizationAdvisory } from '../services/aiRouterClient.js'
import { syncOrganizationAggregate, syncOrganizationCollections, organizationWriteEnabled, organizationFallbackEnabled } from '../repositories/organizationOperationsRepository.js'
import { createSponsorshipApplication, createSponsorshipPackage, hackathonOutcome, listSponsorshipPackages, convertHackathonTeam } from '../services/organizationProgramService.js'

function result(res, value, success = 200) { if (value?.ok === false) return res.status(value.error?.includes('denied') || value.error === 'organization_context_required' ? 403 : value.error?.includes('not_found') ? 404 : 400).json(value); return res.status(success).json(value) }
async function persisted(req, value, collections = false) { if (!organizationWriteEnabled() || value?.ok === false) return value; const organizationId = value.organizationId || value.action?.organizationId || value.kpi?.organizationId || req.body?.organizationId || req.query?.organizationId; if (!organizationId) return value; try { await syncOrganizationAggregate(organizationId); if (collections) await syncOrganizationCollections(organizationId); return value } catch (error) { console.error(JSON.stringify({ event: 'organization_postgres_write_failed', organizationId, error: error.message })); if (organizationFallbackEnabled('WRITE')) return value; return { ok: false, error: 'organization_write_temporarily_unavailable' } } }
export const overview = (req, res) => result(res, organizationOverview(req.user.id, req.query.organizationId))
export const pulse = (req, res) => result(res, organizationPulse(req.user.id, req.query))
export const risks = (req, res) => result(res, organizationRisks(req.user.id, req.query))
export const actions = async (req, res) => result(res, await listOrganizationActionsAsync(req.user.id, req.query))
export const actionCreate = async (req, res) => result(res, await createOrganizationActionAsync(req.user.id, req.body), 201)
export const actionPatch = async (req, res) => result(res, await updateOrganizationActionAsync(req.user.id, req.params.actionId, req.body))
export const kpis = async (req, res) => result(res, await listOrganizationKpisAsync(req.user.id, req.query.organizationId))
export const kpiSave = async (req, res) => result(res, await saveOrganizationKpiAsync(req.user.id, req.body), 201)
export const auditVerify = (req, res) => result(res, verifyOrganizationAudit(req.user.id, req.query.organizationId))
export const briefingEvidence = (req, res) => result(res, organizationBriefingEvidence(req.user.id, req.query.organizationId))
export async function briefing(req, res) { const evidence = organizationBriefingEvidence(req.user.id, req.body.organizationId); if (evidence.ok === false) return result(res, evidence); const advisory = await requestOrganizationAdvisory(req.user.token, evidence); return res.json({ ok: true, organizationId: evidence.organizationId, evidence, advisory, aiAvailable: Boolean(advisory) }) }
export const refresh = async (req, res) => result(res, await persisted(req, refreshOrganizationIntelligence(req.user.id, req.body.organizationId), true))
export const recommendations = (req, res) => result(res, organizationRecommendations(req.user.id, req.query.organizationId))
export const activity = (req, res) => result(res, organizationActivity(req.user.id, req.query))
export const members = (req, res) => result(res, organizationMembers(req.user.id, req.query.organizationId))
export const memberPatch = async (req, res) => result(res, await persisted(req, updateOrganizationMember(req.user.id, req.params.memberId, req.body), true))
export const cohorts = async (req, res) => result(res, await listOrganizationCollectionAsync(req.user.id, 'organizationCohorts', req.query.organizationId))
export const cohortCreate = async (req, res) => result(res, await persisted(req, createOrganizationCohort(req.user.id, req.body), true), 201)
export const partners = async (req, res) => result(res, await listOrganizationCollectionAsync(req.user.id, 'organizationPartners', req.query.organizationId))
export const partnerCreate = async (req, res) => result(res, await persisted(req, createOrganizationPartner(req.user.id, req.body), true), 201)
export const resources = async (req, res) => result(res, await listOrganizationCollectionAsync(req.user.id, 'organizationResources', req.query.organizationId))
export const resourceCreate = async (req, res) => result(res, await persisted(req, createOrganizationResource(req.user.id, req.body), true), 201)
export const reportSchedules = async (req, res) => result(res, await listOrganizationCollectionAsync(req.user.id, 'organizationReportSchedules', req.query.organizationId))
export const reportScheduleCreate = async (req, res) => result(res, await persisted(req, createReportSchedule(req.user.id, req.body), true), 201)
export const auditEvents = (req, res) => result(res, organizationAuditEvents(req.user.id, req.query))
export const startups = (req, res) => result(res, organizationStartupPortfolio(req.user.id, req.query))
export const programHealth = (req, res) => result(res, organizationProgramHealth(req.user.id, req.params.programId, req.query.organizationId))
export const reportGenerate = (req, res) => result(res, generateOrganizationReport(req.user.id, req.body), 201)
export const resourceAllocation = (req, res) => result(res, organizationResourceAllocation(req.user.id, req.query.organizationId))
export const alumniOutcomes = (req, res) => result(res, organizationAlumniOutcomes(req.user.id, req.query.organizationId))
export const cohortBenchmarks = (req, res) => result(res, organizationCohortBenchmarks(req.user.id, req.query.organizationId))
export const sponsorPackages = (req, res) => result(res, listSponsorshipPackages(req.user.id, req.query.organizationId))
export const sponsorPackageCreate = (req, res) => result(res, createSponsorshipPackage(req.user.id, req.body), 201)
export const sponsorApplicationCreate = (req, res) => result(res, createSponsorshipApplication(req.user.id, req.body), 201)
export const hackathonOutcomeReport = (req, res) => result(res, hackathonOutcome(req.user.id, req.params.hackathonId))
export const hackathonTeamConvert = (req, res) => result(res, convertHackathonTeam(req.user.id, req.params.hackathonId, req.params.teamId, req.body), 201)
