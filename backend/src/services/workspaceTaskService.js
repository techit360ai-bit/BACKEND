// workspaceTaskService.js
//
// Real event transport for workspace agent tasks (the Agents console).
//
// A task is a `workspaceTasks` row whose `events` array is the transcript. The
// console polls `getWorkspaceTask` and this service is the producer:
//  - appendWorkspaceTaskEvent records a single event (used by approvals too),
//  - runWorkspaceTask drives one execution: it records the running state, asks the
//    AI router for a real answer, records the answer, and settles the status.
//
// Nothing here fabricates an agent message: when the AI router is unreachable the
// task is marked failed with an explicit error event.

import { createId, nowIso } from '../utils/api.js'
import { listWorkspaceCollection, patchWorkspaceCollectionItem } from './domainService.js'
import { requestWorkspaceConversation } from './aiRouterClient.js'

const TERMINAL = new Set(['done', 'failed', 'cancelled'])

function publicTask(task) {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    agentId: task.agentId || '',
    prompt: task.prompt || task.title || '',
    status: task.status || 'queued',
    createdAt: task.createdAt || null,
    updatedAt: task.updatedAt || null,
    events: Array.isArray(task.events) ? task.events : [],
  }
}

function findTask(userId, workspaceId, taskId) {
  const rows = listWorkspaceCollection(userId, workspaceId, 'workspaceTasks')
  if (!rows) return { ok: false, status: 404, error: 'workspace_not_found' }
  const task = rows.find(row => row.id === taskId)
  if (!task) return { ok: false, status: 404, error: 'task_not_found' }
  return { ok: true, task }
}

export function getWorkspaceTask(userId, workspaceId, taskId) {
  const found = findTask(userId, workspaceId, taskId)
  if (!found.ok) return found
  return { ok: true, task: publicTask(found.task) }
}

export function appendWorkspaceTaskEvent(userId, workspaceId, taskId, body = {}) {
  const found = findTask(userId, workspaceId, taskId)
  if (!found.ok) return found
  const type = ['message', 'status', 'error', 'tool_call', 'tool_result', 'approval_request', 'approval_resolved'].includes(body.type)
    ? body.type
    : 'message'
  const event = {
    id: createId('task_event'),
    type,
    at: nowIso(),
    text: typeof body.text === 'string' ? body.text.slice(0, 8000) : undefined,
    ...(body.approval && typeof body.approval === 'object' ? { approval: body.approval } : {}),
  }
  const events = [...(Array.isArray(found.task.events) ? found.task.events : []), event]
  const status = typeof body.status === 'string' && ['queued', 'running', 'needs_approval', 'done', 'failed', 'cancelled'].includes(body.status)
    ? body.status
    : found.task.status
  const updated = patchWorkspaceCollectionItem(userId, workspaceId, 'workspaceTasks', taskId, { events, status })
  if (!updated) return { ok: false, status: 403, error: 'task_write_denied' }
  return { ok: true, task: publicTask(updated), event }
}

export async function runWorkspaceTask(userId, workspaceId, taskId, token) {
  const found = findTask(userId, workspaceId, taskId)
  if (!found.ok) return found
  if (TERMINAL.has(found.task.status)) return { ok: false, status: 409, error: 'task_already_settled' }

  const prompt = String(found.task.prompt || found.task.title || '').trim()
  if (!prompt) return { ok: false, status: 400, error: 'task_prompt_required' }

  const events = [...(Array.isArray(found.task.events) ? found.task.events : [])]
  events.push({ id: createId('task_event'), type: 'status', at: nowIso(), text: 'Running' })
  events.push({ id: createId('task_event'), type: 'message', at: nowIso(), text: prompt })
  patchWorkspaceCollectionItem(userId, workspaceId, 'workspaceTasks', taskId, { events, status: 'running' })

  const response = await requestWorkspaceConversation(token, {
    workspace_id: workspaceId,
    message: prompt,
  })

  if (response?.message) {
    events.push({ id: createId('task_event'), type: 'message', at: nowIso(), text: String(response.message).slice(0, 8000) })
    events.push({ id: createId('task_event'), type: 'status', at: nowIso(), text: 'Completed' })
    const updated = patchWorkspaceCollectionItem(userId, workspaceId, 'workspaceTasks', taskId, {
      events,
      status: 'done',
      aiModel: response.model_used || null,
    })
    return { ok: true, task: publicTask(updated), ran: true }
  }

  events.push({ id: createId('task_event'), type: 'error', at: nowIso(), text: 'The AI router did not answer, so the task stopped without a result.' })
  const updated = patchWorkspaceCollectionItem(userId, workspaceId, 'workspaceTasks', taskId, { events, status: 'failed' })
  return { ok: false, status: 503, error: 'ai_router_unavailable', task: publicTask(updated) }
}
