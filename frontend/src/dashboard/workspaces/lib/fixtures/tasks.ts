import type { AgentTask, TaskEvent } from '../types';

// A seeded task that has already finished.
const doneEvents: TaskEvent[] = [
  { id: 'e1', type: 'status', at: '2026-06-04T10:00:00Z', text: 'Task started' },
  { id: 'e2', type: 'message', at: '2026-06-04T10:00:02Z', text: 'Reading the auth module to locate the token refresh logic.' },
  { id: 'e3', type: 'tool_call', at: '2026-06-04T10:00:03Z', tool: { connectorId: 'github', name: 'read_file', params: { repo: 'techit-core', path: 'src/auth.ts' } } },
  { id: 'e4', type: 'tool_result', at: '2026-06-04T10:00:04Z', result: { ok: true, detail: 'auth.ts (142 lines)' } },
  { id: 'e5', type: 'message', at: '2026-06-04T10:00:06Z', text: 'Found the bug: token expiry not checked before refresh. Patch ready.' },
  { id: 'e6', type: 'status', at: '2026-06-04T10:00:07Z', text: 'Completed' },
];

export const tasksFixture: AgentTask[] = [
  { id: 't1', agentId: '1', prompt: 'Find and fix the OAuth token refresh bug', status: 'done', createdAt: '2026-06-04T10:00:00Z', events: doneEvents },
  { id: 't2', agentId: '4', prompt: 'Scan the repo for hardcoded secrets', status: 'failed', createdAt: '2026-06-04T11:00:00Z', events: [
    { id: 'f1', type: 'status', at: '2026-06-04T11:00:00Z', text: 'Task started' },
    { id: 'f2', type: 'error', at: '2026-06-04T11:00:01Z', text: 'Security connector unavailable (mock error state)' },
  ] },
];

// Scripted stream replayed by createTask(). Pauses on the approval_request
// until resolveApproval() is called (handled in api/tasks.ts).
export function scriptedStream(_agentId: string, prompt: string): TaskEvent[] {
  return [
    { id: 's1', type: 'status', at: '', text: 'Task started' },
    { id: 's2', type: 'message', at: '', text: `Understood. Working on: "${prompt}".` },
    { id: 's3', type: 'tool_call', at: '', tool: { connectorId: 'figma', name: 'extract_design_tokens', params: { file_id: 'abc123' } } },
    { id: 's4', type: 'tool_result', at: '', result: { ok: true, detail: 'Button primary: #1A3C5E → #0E7DC2' } },
    { id: 's5', type: 'message', at: '', text: 'Token change detected. I will open a PR to apply it.' },
    { id: 's6', type: 'approval_request', at: '', approval: { id: 'ap1', action: 'create_pull_request', connectorId: 'github', summary: 'Open PR "Design sync: Update Button primary color" against main' } },
    { id: 's7', type: 'tool_call', at: '', tool: { connectorId: 'github', name: 'create_pull_request', params: { repo: 'techit-core', branch: 'agent/design-sync', title: 'Design sync: Update Button primary color' } } },
    { id: 's8', type: 'tool_result', at: '', result: { ok: true, detail: 'PR #43 opened' } },
    { id: 's9', type: 'status', at: '', text: 'Completed' },
  ];
}
