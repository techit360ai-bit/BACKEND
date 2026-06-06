import type { ActivityEvent } from '../types';

export const activityFixture: ActivityEvent[] = [
  { id: 'a1', connectorId: 'figma', kind: 'webhook', summary: 'Figma file "Design System" updated → Design Agent opened PR #42', at: '2026-06-05T08:41:00Z' },
  { id: 'a2', connectorId: 'github', kind: 'agent_action', summary: 'Coding Agent opened PR #42: "Design sync: Button primary color"', at: '2026-06-05T08:42:00Z' },
  { id: 'a3', connectorId: 'github', kind: 'approval', summary: 'Approval requested: merge PR #42 to main', at: '2026-06-05T08:43:00Z' },
  { id: 'a4', connectorId: 'ml', kind: 'sync', summary: 'ML registry sync failed: invalid API key', at: '2026-06-05T07:10:00Z' },
];
