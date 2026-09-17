import {
  addMessage,
  createCase,
  getCase,
  listAdminCases,
  listCases,
  submitFeedback,
  supportOverview,
  updateCase,
  acquireCaseLock,
  analytics,
  configureSupport,
  diagnostics,
  runMaintenance,
  supportConfiguration,
  intelligenceProjection,
  reopenCase,
  listKnowledgeBase,
  saveKnowledgeArticle,
  saveTemplate,
  attachMetadata,
  correctiveAction,
  supportPermissionAllowed,
  initAttachment,
  finalizeAttachment,
  supportDirectory,
  listKnowledgeBaseAdmin,
  listTemplates,
} from '../services/supportService.js'
import { requestSupportIntelligence } from '../services/aiRouterClient.js'
import { reconcileEntitlement } from '../services/supportBillingAdapter.js'
import { operationalStateEnabled, operationalStateFallbackEnabled, syncOperationalState } from '../repositories/operationalStateRepository.js'

function sendResult(res, value, fallbackStatus = 200) {
  if (!value?.ok) return res.status(value?.status || 400).json({ error: value?.error || 'support_request_failed', ...(value?.case ? { case: value.case } : {}) })
  return res.status(fallbackStatus).json(value)
}
async function persisted(req, value) { if (!operationalStateEnabled() || value?.ok === false) return value; try { await syncOperationalState(req.user?.id || null); return value } catch (error) { if (operationalStateFallbackEnabled()) return value; return { ok: false, status: 503, error: 'operational_write_temporarily_unavailable' } } }

export async function userCaseCreate(req, res) { return sendResult(res, await persisted(req, createCase(req.user.id, req.body, req.user.role)), 201) }
export function userCaseList(req, res) { return sendResult(res, listCases(req.user.id)) }
export function userCaseGet(req, res) { return sendResult(res, getCase(req.user.id, req.params.caseId)) }
export async function userCaseMessage(req, res) { return sendResult(res, await persisted(req, addMessage(req.user.id, req.params.caseId, req.body, false)), 201) }
export async function userCaseFeedback(req, res) { return sendResult(res, await persisted(req, submitFeedback(req.user.id, req.params.caseId, req.body)), 201) }
export async function userCaseReopen(req, res) { return sendResult(res, await persisted(req, reopenCase(req.user.id, req.params.caseId))) }
export function userKnowledge(_req, res) { return sendResult(res, listKnowledgeBase()) }
export function userCaseAttachment(req, res) { return sendResult(res, attachMetadata(req.user.id, req.params.caseId, req.body, false), 201) }
export function userAttachmentInit(req, res) { return sendResult(res, initAttachment(req.user.id, req.params.caseId, req.body, false), 201) }
export async function userAttachmentFinalize(req, res) { return sendResult(res, await finalizeAttachment(req.user.id, req.params.caseId, req.params.attachmentId, false)) }
export function adminCaseList(req, res) { return sendResult(res, listAdminCases(req.query)) }
export function adminDirectory(_req, res) { return sendResult(res, supportDirectory()) }
export function adminCaseGet(req, res) { return sendResult(res, getCase(req.user.id, req.params.caseId, true)) }
export async function adminCaseMessage(req, res) { return sendResult(res, await persisted(req, addMessage(req.user.id, req.params.caseId, req.body, true)), 201) }
export function adminCaseUpdate(req, res) {
  const needed = req.body.status === 'resolved' ? 'support.resolve' : req.body.status === 'closed' ? 'support.close' : req.body.status === 'escalated' ? 'support.escalate' : req.body.status === 'reopened' ? 'support.reopen' : 'support.assign'
  if (!supportPermissionAllowed(req.user, needed)) return res.status(403).json({ error: 'Support permission required', permission: needed })
  return persisted(req, updateCase(req.user.id, req.params.caseId, req.body)).then(value => sendResult(res, value))
}
export function adminOverview(_req, res) { return sendResult(res, supportOverview()) }
export function adminDiagnostics(req, res) { return sendResult(res, diagnostics(req.user.id, req.params.caseId, true)) }
export function adminLock(req, res) { return sendResult(res, acquireCaseLock(req.user.id, req.params.caseId)) }
export function adminConfig(req, res) {
  const result = supportConfiguration()
  if (result.ok && !supportPermissionAllowed(req.user, 'support.manage_teams')) result.teams = (result.teams || []).map(({ notificationEmails, whatsappNumbers, ...team }) => team)
  if (result.ok && !supportPermissionAllowed(req.user, 'support.manage_knowledge_base')) result.knowledgeBase = []
  if (result.ok && !supportPermissionAllowed(req.user, 'support.manage_templates')) result.templates = []
  return sendResult(res, result)
}
export async function adminConfigUpdate(req, res) {
  const body = req.body || {}
  const required = new Set()
  if (body.sla || body.businessHoursEnabled !== undefined || body.duplicateCooldownHours !== undefined || body.resolutionGraceHours !== undefined || body.incidentThreshold !== undefined) required.add('support.manage_sla')
  if (body.retentionDays !== undefined) required.add('support.manage_retention')
  if (body.categories) required.add('support.manage_categories')
  if (body.teams) required.add('support.manage_teams')
  for (const permission of required) if (!supportPermissionAllowed(req.user, permission)) return res.status(403).json({ error: 'Support permission required', permission })
  return sendResult(res, await persisted(req, configureSupport(req.user.id, body)))
}
export function adminAnalytics(_req, res) { return sendResult(res, analytics()) }
export function adminIntelligence(_req, res) { return sendResult(res, intelligenceProjection()) }
export function adminMaintenance(_req, res) { return sendResult(res, runMaintenance()) }
export async function adminKnowledgeSave(req, res) { return sendResult(res, await persisted(req, saveKnowledgeArticle(req.user.id, req.body))) }
export async function adminTemplateSave(req, res) { return sendResult(res, await persisted(req, saveTemplate(req.user.id, req.body))) }
export function adminKnowledgeList(_req, res) { return sendResult(res, listKnowledgeBaseAdmin()) }
export function adminTemplateList(_req, res) { return sendResult(res, listTemplates()) }
export function adminAttachment(req, res) { return sendResult(res, attachMetadata(req.user.id, req.params.caseId, req.body, true), 201) }
export function adminAttachmentInit(req, res) { return sendResult(res, initAttachment(req.user.id, req.params.caseId, req.body, true), 201) }
export async function adminAttachmentFinalize(req, res) { return sendResult(res, await finalizeAttachment(req.user.id, req.params.caseId, req.params.attachmentId, true)) }
export async function adminCorrectiveAction(req, res) { const needed = req.body.action === 'reissue_credits' ? 'support.modify_credits' : req.body.action?.includes('entitlement') ? 'support.modify_billing' : 'support.modify_account'; if (!supportPermissionAllowed(req.user, needed)) return res.status(403).json({ error: 'Support permission required', permission: needed }); if (req.body.confirm !== true || !String(req.body.reason || '').trim()) return res.status(400).json({ error: 'confirmation_and_reason_required' }); if (['retry_entitlement_sync', 'recalculate_entitlement'].includes(req.body.action)) return sendResult(res, await persisted(req, await reconcileEntitlement(req.user.id, req.params.caseId, req.body.reason))); return sendResult(res, await persisted(req, correctiveAction(req.user.id, req.params.caseId, req.body)), 202) }
export async function adminAi(req, res) {
  const result = await requestSupportIntelligence(req.user.token, { mode: req.body.mode || 'draft_response', case: req.body.case, messages: req.body.messages, knowledge: req.body.knowledge })
  return result ? res.json({ ok: true, intelligence: result }) : res.status(503).json({ error: 'support_ai_unavailable' })
}
export function caseStream(req, res) {
  const caseId = req.params.caseId
  const initial = getCase(req.user.id, caseId)
  if (!initial.ok) return sendResult(res, initial)
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders?.()
  let last = JSON.stringify(initial.case)
  const send = () => { const next = getCase(req.user.id, caseId); if (!next.ok) return; const serialized = JSON.stringify({ case: next.case, messages: next.messages.slice(-20) }); if (serialized !== last) { res.write(`event: support_update\ndata: ${serialized}\n\n`); last = serialized } }
  res.write(`event: support_ready\ndata: ${JSON.stringify({ caseId })}\n\n`)
  const timer = setInterval(send, 5000); req.on('close', () => clearInterval(timer))
}
export function supportHealth(_req, res) { return res.json({ status: 'ok', feature: 'CUSTOMER_SUPPORT_SYSTEM', enabled: process.env.CUSTOMER_SUPPORT_SYSTEM !== '0' }) }
