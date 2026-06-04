import type { AgentTask, TaskEvent } from '../types';
import { tasksFixture, scriptedStream } from '../fixtures/tasks';
import { delay, nextId } from './client';

let tasks: AgentTask[] = tasksFixture.map((t) => ({ ...t, events: [...t.events] }));

// GET /api/agent/tasks
export async function listTasks(): Promise<AgentTask[]> {
  await delay();
  return tasks.map((t) => ({ ...t }));
}

// GET /api/agent/tasks/:id
export async function getTask(id: string): Promise<AgentTask | undefined> {
  const t = tasks.find((x) => x.id === id);
  return t ? { ...t } : undefined;
}

// POST /api/agent/tasks  — creates the task record, returns its id.
export async function createTask(agentId: string, prompt: string): Promise<string> {
  await delay();
  const id = nextId('task');
  tasks = [{ id, agentId, prompt, status: 'queued', createdAt: '', events: [] }, ...tasks];
  return id;
}

// Pending approval resolver bridge: streamTask waits on this promise.
const approvalWaiters: Record<string, (decision: 'approved' | 'rejected') => void> = {};

// POST /api/agent/tasks/:id/approvals/:aid
export async function resolveApproval(taskId: string, approvalId: string, decision: 'approved' | 'rejected'): Promise<void> {
  const key = `${taskId}:${approvalId}`;
  approvalWaiters[key]?.(decision);
  delete approvalWaiters[key];
}

// GET /api/agent/tasks/:id/stream (SSE in real backend).
// Mock: async generator replaying the scripted stream with delays, pausing on approval.
export async function* streamTask(taskId: string): AsyncGenerator<TaskEvent> {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const script = scriptedStream(task.agentId, task.prompt);
  let stamp = 0;
  for (const ev of script) {
    await delay(450);
    const event: TaskEvent = { ...ev, at: `mock+${++stamp}` };
    if (event.type === 'approval_request' && event.approval) {
      const decision = await new Promise<'approved' | 'rejected'>((resolve) => {
        approvalWaiters[`${taskId}:${event.approval!.id}`] = resolve;
      });
      yield { ...event, approval: { ...event.approval, resolved: decision } };
      if (decision === 'rejected') {
        yield { id: nextId('e'), type: 'status', at: `mock+${++stamp}`, text: 'Cancelled by user' };
        return;
      }
      continue;
    }
    yield event;
  }
}
