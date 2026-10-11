import { computeUserState, getSessionContext, createCheckpoint, clearCheckpoint } from '../services/contextService.js'
import { availableContexts, getActiveContext, switchContext as switchActiveContext, touchContext } from '../services/multiRoleContextService.js'

export async function sessionContext(req, res) {
  const role = req.user.role === 'organization' ? 'organisation' : (req.user.role || 'explorer')
  await computeUserState(req.user.id, role)
  const context = await getSessionContext(req.user.id, role)
  return res.json(context)
}

export async function postCheckpoint(req, res) {
  const result = await createCheckpoint(req.user.id, req.body)
  return res.status(201).json(result)
}

export async function deleteCheckpoint(req, res) {
  const { type, referenceId } = req.params
  const result = await clearCheckpoint(req.user.id, type, referenceId)
  return res.json(result)
}

export function activeContext(req, res) { return res.json({ activeContext: getActiveContext(req.user.id) }) }
export function availableContext(req, res) { return res.json(availableContexts(req.user.id)) }
export function switchContext(req, res) {
  const result = switchActiveContext(req.user.id, req.body || {})
  return result.ok ? res.json(result) : res.status(403).json(result)
}
export function touchActiveContext(req, res) {
  const result = touchContext(req.user.id, req.body || {})
  return result.ok ? res.json(result) : res.status(403).json(result)
}
