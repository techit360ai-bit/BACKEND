/**
 * End-to-end visual walkthrough of the plugin/connector system.
 *
 *   npm run demo
 *
 * Narrates each stage so you can SEE the cross-cutting guarantees fire:
 *   register → invoke (allowed) → permission denial → approval gate →
 *   human approval → execute → audit log + contribution feed.
 */

import type { Actor, AgentDefinition } from '@techit/core';
import {
  InMemoryApprovalStore,
  InMemoryContributionSink,
} from '@techit/core';
import { InMemoryAuditLogger } from '@techit/infra-audit';
import { createRuntime } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerGithubPlugin } from '@techit/plugin-github';

const WS = 'ws-acme';
const c = {
  h: (s: string) => `\n\x1b[1m\x1b[36m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  no: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function show(label: string, result: { ok: boolean; data?: unknown; error?: unknown; approvalRequestId?: string }) {
  if (result.ok) {
    console.log(`  ${c.ok('✓ ok')}  ${label}  ${c.dim(JSON.stringify(result.data).slice(0, 70))}`);
  } else {
    const code = (result.error as { code?: string })?.code;
    console.log(`  ${c.no('✗ ' + code)}  ${label}`);
  }
}

async function main() {
  // ---- wire infra so we can inspect it afterwards ----
  const audit = new InMemoryAuditLogger();
  const approvals = new InMemoryApprovalStore();
  const contributions = new InMemoryContributionSink();
  const runtime = createRuntime({ audit, approvals, contributions });
  const registry = new MCPRegistry();

  console.log(c.h('1. Register the GitHub plugin (register → authenticate → ready)'));
  await registerGithubPlugin({ runtime, registry, workspaceId: WS });
  const client = new MCPClient(registry);
  console.log(`  registered tools: ${registry.catalogue().map((t) => t.tool.name).join(', ')}`);

  // ---- actors ----
  const founder: Actor = { id: 'founder', kind: 'human', workspaceId: WS, role: 'owner' };
  const viewer: Actor = { id: 'guest', kind: 'human', workspaceId: WS, role: 'viewer' };
  const agentDef: AgentDefinition = {
    id: 'coding-agent', name: 'Coding Agent', workspaceId: WS,
    toolsAllowed: ['github.read_file', 'github.create_pull_request'], maxRole: 'editor',
  };
  const agent: Actor = { id: 'coding-agent', kind: 'agent', workspaceId: WS, role: 'editor' };
  const ctx = (a: Actor, ag?: AgentDefinition) => ({ actor: a, agent: ag, resourceWorkspaceId: WS });

  console.log(c.h('2. Founder reads a file (permitted)'));
  show('founder → read_file', await client.invoke('github', 'read_file', { repo: 'acme/app', path: 'README.md' }, ctx(founder)));

  console.log(c.h('3. Permission minimisation — agent tries a tool NOT in its allow-list'));
  show('agent → run_workflow (not allowed)', await client.invoke('github', 'run_workflow', { repo: 'acme/app', workflow: 'deploy.yml', ref: 'main' }, ctx(agent, agentDef)));

  console.log(c.h('4. RBAC — a viewer tries an editor-level action'));
  show('viewer → create_pull_request', await client.invoke('github', 'create_pull_request', { repo: 'acme/app', head: 'feat', base: 'main', title: 'x' }, ctx(viewer)));

  console.log(c.h('5. Approval gate — agent opens a PR (destructive) → pauses for human'));
  const pending = await client.invoke('github', 'create_pull_request', { repo: 'acme/app', head: 'feat/login', base: 'main', title: 'Add login' }, ctx(agent, agentDef));
  show('agent → create_pull_request', pending);
  const approvalId = !pending.ok ? pending.approvalRequestId! : '';
  console.log(`  ${c.dim('approval request: ' + approvalId + ' (status: ' + approvals.get(approvalId)?.status + ')')}`);

  console.log(c.h('6. Founder approves → agent retries → executes'));
  await approvals.decide({ requestId: approvalId, decidedBy: 'founder', status: 'approved', decidedAt: new Date().toISOString() });
  show('agent → create_pull_request (approved)', await client.invoke('github', 'create_pull_request', { repo: 'acme/app', head: 'feat/login', base: 'main', title: 'Add login', approvalRequestId: approvalId }, ctx(agent, agentDef)));

  console.log(c.h('7. Immutable audit log (every action, success | denied | pending_approval)'));
  for (const e of audit.entries()) {
    const color = e.result === 'success' ? c.ok : e.result === 'failure' ? c.no : c.dim;
    console.log(`  ${c.dim(e.timestamp.slice(11, 19))}  ${e.actorKind.padEnd(5)} ${e.actor.padEnd(13)} ${e.action.padEnd(20)} ${color(e.result)}`);
  }

  console.log(c.h('8. Contribution feed (execution intelligence)'));
  for (const ev of contributions.events) {
    console.log(`  ${c.dim(ev.timestamp.slice(11, 19))}  ${ev.actorKind.padEnd(5)} ${ev.actorId.padEnd(13)} ${ev.kind}`);
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
