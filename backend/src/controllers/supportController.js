import {
  addMessage,
  createCase,
  getCase,
  listAdminCases,
  listCases,
  submitFeedback,
  supportOverview,
  updateCase,
} from '../services/supportService.js'

function sendResult(res, value, fallbackStatus = 200) {
  if (!value?.ok) return res.status(value?.status || 400).json({ error: value?.error || 'support_request_failed', ...(value?.case ? { case: value.case } : {}) })
  return res.status(fallbackStatus).json(value)
}

export function userCaseCreate(req, res) { return sendResult(res, createCase(req.user.id, req.body, req.user.role), 201) }
export function userCaseList(req, res) { return sendResult(res, listCases(req.user.id)) }
export function userCaseGet(req, res) { return sendResult(res, getCase(req.user.id, req.params.caseId)) }
export function userCaseMessage(req, res) { return sendResult(res, addMessage(req.user.id, req.params.caseId, req.body, false), 201) }
export function userCaseFeedback(req, res) { return sendResult(res, submitFeedback(req.user.id, req.params.caseId, req.body), 201) }
export function adminCaseList(req, res) { return sendResult(res, listAdminCases(req.query)) }
export function adminCaseGet(req, res) { return sendResult(res, getCase(req.user.id, req.params.caseId, true)) }
export function adminCaseMessage(req, res) { return sendResult(res, addMessage(req.user.id, req.params.caseId, req.body, true), 201) }
export function adminCaseUpdate(req, res) { return sendResult(res, updateCase(req.user.id, req.params.caseId, req.body)) }
export function adminOverview(_req, res) { return sendResult(res, supportOverview()) }
