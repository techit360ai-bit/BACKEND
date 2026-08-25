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
} from '../services/supportService.js'
import { requestSupportIntelligence } from '../services/aiRouterClient.js'
import { reconcileEntitlement } from '../services/supportBillingAdapter.js'

function sendResult(res, value, fallbackStatus = 200) {
  if (!value?.ok) return res.status(value?.status || 400).json({ error: value?.error || 'support_request_failed', ...(value?.case ? { case: value.case } : {}) })
  return res.status(fallbackStatus).json(value)
}

export function userCaseCreate(req, res) { return sendResult(res, createCase(req.user.id, req.body, req.user.role), 201) }
export function userCaseList(req, res) { return sendResult(res, listCases(req.user.id)) }
export function userCaseGet(req, res) { return sendResult(res, getCase(req.user.id, req.params.caseId)) }
export function userCaseMessage(req, res) { return sendResult(res, addMessage(req.user.id, req.params.caseId, req.body, false), 201) }
export function userCaseFeedback(req, res) { return sendResult(res, submitFeedback(req.user.id, req.params.caseId, req.body), 201) }
export function userCaseReopen(req, res) { return sendResult(res, reopenCase(req.user.id, req.params.caseId)) }
export function userKnowledge(_req, res) { return sendResult(res, listKnowledgeBase()) }
export function userCaseAttachment(req, res) { return sendResult(res, attachMetadata(req.user.id, req.params.caseId, req.body, false), 201) }
export function userAttachmentInit(req, res) { return sendResult(res, initAttachment(req.user.id, req.params.caseId, req.body, false), 201) }
export async function userAttachmentFinalize(req, res) { return sendResult(res, await finalizeAttachment(req.user.id, req.params.caseId, req.params.attachmentId, false)) }
export function adminCaseList(req, res) { return sendResult(res, listAdminCases(req.query)) }
export function adminCaseGet(req, res) { return sendResult(res, getCase(req.user.id, req.params.caseId, true)) }
export function adminCaseMessage(req, res) { return sendResult(res, addMessage(req.user.id, req.params.caseId, req.body, true), 201) }
export function adminCaseUpdate(req, res) {
  const needed = req.body.status === 'resolved' ? 'support.resolve' : req.body.status === 'closed' ? 'support.close' : req.body.status === 'escalated' ? 'support.escalate' : 'support.assign'
  if (!supportPermissionAllowed(req.user, needed)) return res.status(403).json({ error: 'Support permission required', permission: needed })
  return sendResult(res, updateCase(req.user.id, req.params.caseId, req.body))
}
export function adminOverview(_req, res) { return sendResult(res, supportOverview()) }
export function adminDiagnostics(req, res) { return sendResult(res, diagnostics(req.user.id, req.params.caseId, true)) }
export function adminLock(req, res) { return sendResult(res, acquireCaseLock(req.user.id, req.params.caseId)) }
export function adminConfig(req, res) { return sendResult(res, supportConfiguration()) }
export function adminConfigUpdate(req, res) { return sendResult(res, configureSupport(req.user.id, req.body)) }
export function adminAnalytics(_req, res) { return sendResult(res, analytics()) }
export function adminIntelligence(_req, res) { return sendResult(res, intelligenceProjection()) }
export function adminMaintenance(_req, res) { return sendResult(res, runMaintenance()) }
export function adminKnowledgeSave(req, res) { return sendResult(res, saveKnowledgeArticle(req.user.id, req.body)) }
export function adminTemplateSave(req, res) { return sendResult(res, saveTemplate(req.user.id, req.body)) }
export function adminAttachment(req, res) { return sendResult(res, attachMetadata(req.user.id, req.params.caseId, req.body, true), 201) }
export function adminAttachmentInit(req, res) { return sendResult(res, initAttachment(req.user.id, req.params.caseId, req.body, true), 201) }
export async function adminAttachmentFinalize(req, res) { return sendResult(res, await finalizeAttachment(req.user.id, req.params.caseId, req.params.attachmentId, true)) }
export async function adminCorrectiveAction(req, res) { const needed = req.body.action === 'reissue_credits' ? 'support.modify_credits' : req.body.action?.includes('entitlement') ? 'support.modify_billing' : 'support.modify_account'; if (!supportPermissionAllowed(req.user, needed)) return res.status(403).json({ error: 'Support permission required', permission: needed }); if (req.body.confirm !== true || !String(req.body.reason || '').trim()) return res.status(400).json({ error: 'confirmation_and_reason_required' }); if (['retry_entitlement_sync', 'recalculate_entitlement'].includes(req.body.action)) return sendResult(res, await reconcileEntitlement(req.user.id, req.params.caseId, req.body.reason)); return sendResult(res, correctiveAction(req.user.id, req.params.caseId, req.body), 202) }
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
