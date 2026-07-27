import { computeUserState, getSessionContext, createCheckpoint, clearCheckpoint } from '../services/contextService.js'

export function sessionContext(req, res) {
  const role = req.user.role || 'founder'
  computeUserState(req.user.id, role)
  const context = getSessionContext(req.user.id, role)
  return res.json(context)
}

export function postCheckpoint(req, res) {
  const result = createCheckpoint(req.user.id, req.body)
  return res.status(201).json(result)
}

export function deleteCheckpoint(req, res) {
  const { type, referenceId } = req.params
  const result = clearCheckpoint(req.user.id, type, referenceId)
  return res.json(result)
}
