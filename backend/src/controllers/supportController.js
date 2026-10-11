import {
  addMessageAsync,
  createCaseAsync,
  getCaseAsync,
  listAdminCasesAsync,
  listCasesAsync,
  submitFeedbackAsync,
  supportOverviewAsync,
  updateCaseAsync,
  acquireCaseLockAsync,
  analyticsAsync,
  configureSupportAsync,
  diagnosticsAsync,
  runMaintenanceAsync,
  supportConfigurationAsync,
  intelligenceProjectionAsync,
  reopenCaseAsync,
  listKnowledgeBaseAsync,
  saveKnowledgeArticleAsync,
  saveTemplateAsync,
  attachMetadataAsync,
  correctiveActionAsync,
  supportPermissionAllowed,
  initAttachmentAsync,
  finalizeAttachmentAsync,
  supportDirectoryAsync,
  listKnowledgeBaseAdminAsync,
  listTemplatesAsync,
} from '../services/supportService.js'
import { requestSupportIntelligence } from '../services/aiRouterClient.js'
import { reconcileEntitlement } from '../services/supportBillingAdapter.js'
import { operationalStateEnabled, operationalStateFallbackEnabled, syncOperationalState } from '../repositories/operationalStateRepository.js'

function sendResult(res, value, fallbackStatus = 200) {
  if (!value?.ok) return res.status(value?.status || 400).json({ error: value?.error || 'support_request_failed', ...(value?.case ? { case: value.case } : {}) })
  return res.status(fallbackStatus).json(value)
}
async function persisted(req, value) { if (!operationalStateEnabled() || value?.ok === false) return value; try { await syncOperationalState(req.user?.id || null); return value } catch (error) { if (operationalStateFallbackEnabled()) return value; return { ok: false, status: 503, error: 'operational_write_temporarily_unavailable' } } }

export async function userCaseCreate(req, res) { return sendResult(res, await persisted(req, await createCaseAsync(req.user.id, req.body, req.user.role)), 201) }
export async function userCaseList(req, res) { return sendResult(res, await listCasesAsync(req.user.id)) }
export async function userCaseGet(req, res) { return sendResult(res, await getCaseAsync(req.user.id, req.params.caseId)) }
export async function userCaseMessage(req, res) { return sendResult(res, await persisted(req, await addMessageAsync(req.user.id, req.params.caseId, req.body, false)), 201) }
export async function userCaseFeedback(req, res) { return sendResult(res, await persisted(req, await submitFeedbackAsync(req.user.id, req.params.caseId, req.body)), 201) }
export async function userCaseReopen(req, res) { return sendResult(res, await persisted(req, await reopenCaseAsync(req.user.id, req.params.caseId))) }
export async function userKnowledge(_req, res) { return sendResult(res, await listKnowledgeBaseAsync()) }
export async function userCaseAttachment(req, res) { return sendResult(res, await attachMetadataAsync(req.user.id, req.params.caseId, req.body, false), 201) }
export async function userAttachmentInit(req, res) { return sendResult(res, await initAttachmentAsync(req.user.id, req.params.caseId, req.body, false), 201) }
export async function userAttachmentFinalize(req, res) { return sendResult(res, await finalizeAttachmentAsync(req.user.id, req.params.caseId, req.params.attachmentId, false)) }
export async function adminCaseList(req, res) { return sendResult(res, await listAdminCasesAsync(req.query)) }
export async function adminDirectory(req, res) { return sendResult(res, await supportDirectoryAsync(req.user.id)) }
export async function adminCaseGet(req, res) { return sendResult(res, await getCaseAsync(req.user.id, req.params.caseId, true)) }
export async function adminCaseMessage(req, res) { return sendResult(res, await persisted(req, await addMessageAsync(req.user.id, req.params.caseId, req.body, true)), 201) }
export async function adminCaseUpdate(req, res) {
  const needed = req.body.status === 'resolved' ? 'support.resolve' : req.body.status === 'closed' ? 'support.close' : req.body.status === 'escalated' ? 'support.escalate' : req.body.status === 'reopened' ? 'support.reopen' : 'support.assign'
  if (!supportPermissionAllowed(req.user, needed)) return res.status(403).json({ error: 'Support permission required', permission: needed })
  return sendResult(res, await persisted(req, await updateCaseAsync(req.user.id, req.params.caseId, req.body)))
}
export async function adminOverview(_req, res) { return sendResult(res, await supportOverviewAsync()) }
export async function adminDiagnostics(req, res) { return sendResult(res, await diagnosticsAsync(req.user.id, req.params.caseId, true)) }
export async function adminLock(req, res) { return sendResult(res, await acquireCaseLockAsync(req.user.id, req.params.caseId)) }
export async function adminConfig(req, res) {
  const result = await supportConfigurationAsync(req.user.id)
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
  return sendResult(res, await persisted(req, await configureSupportAsync(req.user.id, body)))
}
export async function adminAnalytics(_req, res) { return sendResult(res, await analyticsAsync()) }
export async function adminIntelligence(_req, res) { return sendResult(res, await intelligenceProjectionAsync()) }
export async function adminMaintenance(req, res) { return sendResult(res, await runMaintenanceAsync(req.user.id)) }
export async function adminKnowledgeSave(req, res) { return sendResult(res, await persisted(req, await saveKnowledgeArticleAsync(req.user.id, req.body))) }
export async function adminTemplateSave(req, res) { return sendResult(res, await persisted(req, await saveTemplateAsync(req.user.id, req.body))) }
export async function adminKnowledgeList(_req, res) { return sendResult(res, await listKnowledgeBaseAdminAsync()) }
export async function adminTemplateList(_req, res) { return sendResult(res, await listTemplatesAsync()) }
export async function adminAttachment(req, res) { return sendResult(res, await attachMetadataAsync(req.user.id, req.params.caseId, req.body, true), 201) }
export async function adminAttachmentInit(req, res) { return sendResult(res, await initAttachmentAsync(req.user.id, req.params.caseId, req.body, true), 201) }
export async function adminAttachmentFinalize(req, res) { return sendResult(res, await finalizeAttachmentAsync(req.user.id, req.params.caseId, req.params.attachmentId, true)) }
export async function adminCorrectiveAction(req, res) { const needed = req.body.action === 'reissue_credits' ? 'support.modify_credits' : req.body.action?.includes('entitlement') ? 'support.modify_billing' : 'support.modify_account'; if (!supportPermissionAllowed(req.user, needed)) return res.status(403).json({ error: 'Support permission required', permission: needed }); if (req.body.confirm !== true || !String(req.body.reason || '').trim()) return res.status(400).json({ error: 'confirmation_and_reason_required' }); if (['retry_entitlement_sync', 'recalculate_entitlement'].includes(req.body.action)) return sendResult(res, await persisted(req, await reconcileEntitlement(req.user.id, req.params.caseId, req.body.reason))); return sendResult(res, await persisted(req, await correctiveActionAsync(req.user.id, req.params.caseId, req.body)), 202) }
export async function adminAi(req, res) {
  const result = await requestSupportIntelligence(req.user.token, { mode: req.body.mode || 'draft_response', case: req.body.case, messages: req.body.messages, knowledge: req.body.knowledge })
  return result ? res.json({ ok: true, intelligence: result }) : res.status(503).json({ error: 'support_ai_unavailable' })
}
export async function caseStream(req, res) {
  const caseId = req.params.caseId
  const initial = await getCaseAsync(req.user.id, caseId)
  if (!initial.ok) return sendResult(res, initial)
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders?.()
  let last = JSON.stringify(initial.case)
  let closed = false
  const send = async () => { if (closed) return; const next = await getCaseAsync(req.user.id, caseId).catch(() => null); if (!next?.ok) return; const serialized = JSON.stringify({ case: next.case, messages: next.messages.slice(-20) }); if (serialized !== last) { res.write(`event: support_update\ndata: ${serialized}\n\n`); last = serialized } }
  res.write(`event: support_ready\ndata: ${JSON.stringify({ caseId })}\n\n`)
  const timer = setInterval(() => { void send() }, 5000); req.on('close', () => { closed = true; clearInterval(timer) })
}
export function supportHealth(_req, res) { return res.json({ status: 'ok', feature: 'CUSTOMER_SUPPORT_SYSTEM', enabled: process.env.CUSTOMER_SUPPORT_SYSTEM !== '0' }) }
