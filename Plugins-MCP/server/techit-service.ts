/**
 * TechIT service singleton — builds the plugin runtime once and exposes the
 * three observable surfaces (tools, audit, contributions) plus invoke/approve
 * actions for an HTTP layer. No web framework imported here; the backend mounts
 * these functions onto its own Express app (see ./mount.ts).
 */

import type { Actor, AgentDefinition, Role } from '@techit/core';
import { createRuntime, type CallContext, type Result } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerGithubPlugin } from '@techit/plugin-github';
import { registerBitbucketPlugin, registerGitLabPlugin } from '@techit/plugin-git-host';
import { registerNotionPlugin } from '@techit/plugin-notion';
import { registerFigmaPlugin } from '@techit/plugin-figma';
import { registerWeb3Plugin } from '@techit/plugin-web3';
import { registerAiPlugin } from '@techit/plugin-ai';
import {
  FileApprovalStore,
  FileAuditLogger,
  FileContributionSink,
  validateMcpStoreConfig,
} from './file-store.js';
import {
  createMcpPool,
  EncryptedPgSecretVault,
  migrateMcpDatabase,
  PgMcpStore,
  validatePostgresMcpConfig,
} from './postgres-store.js';

// Default workspaceId used for the demo-seed activity in build() and as a
// fallback when a caller doesn't supply one. Production traffic should
// always come through mount.ts with a verified JWT claim — see
// resolveActor in app.js, which sets ActorInput.workspaceId from the token.
const WS = 'ws-acme';
const CONNECTOR_NAMES = ['github', 'gitlab', 'bitbucket', 'notion', 'figma', 'web3', 'ai'] as const;
type ConnectorName = typeof CONNECTOR_NAMES[number];

export interface ActorInput {
  id?: string;
  kind?: 'human' | 'agent';
  role?: Role;
  /** Tenant scope from the verified JWT (workspaceId claim). Falls back to WS
   *  when omitted — only happens for the in-process seed activity. */
  workspaceId?: string;
  /** For agents: explicit tool allow-list (`<plugin>.<tool>`). */
  toolsAllowed?: string[];
}

export interface TechitService {
  workspaceId: string;
  listTools(): { plugin: string; tool: unknown }[];
  audit(workspaceId?: string): Promise<unknown[]>;
  contributions(workspaceId?: string): Promise<unknown[]>;
  approvals(workspaceId?: string): Promise<unknown[]>;
  healthCheck(): Promise<void>;
  invoke(plugin: string, tool: string, params: unknown, actor?: ActorInput): Promise<Result>;
  approve(
    requestId: string,
    actor?: ActorInput,
  ): Promise<{ approved: true } | { approved: false; reason: string }>;
}

function toContext(input: ActorInput | undefined): CallContext {
  const role: Role = input?.role ?? 'owner';
  const kind = input?.kind ?? 'human';
  const id = input?.id ?? (kind === 'agent' ? 'coding-agent' : 'founder');
  const workspaceId = input?.workspaceId ?? WS;
  const actor: Actor = { id, kind, workspaceId, role };
  if (kind === 'agent') {
    const agent: AgentDefinition = {
      id,
      name: id,
      workspaceId,
      toolsAllowed: input?.toolsAllowed ?? [],
      maxRole: role,
    };
    return { actor, agent, resourceWorkspaceId: workspaceId };
  }
  return { actor, resourceWorkspaceId: workspaceId };
}

async function build(): Promise<TechitService> {
  validateProductionConfig();
  const storeMode = (process.env.MCP_STORE || (isProductionLike() ? 'postgres' : 'file')).toLowerCase();
  let audit: FileAuditLogger | PgMcpStore;
  let approvals: FileApprovalStore | PgMcpStore;
  let contributions: FileContributionSink | PgMcpStore;
  let healthCheck: () => Promise<void>;
  let vault;
  if (storeMode === 'postgres') {
    validatePostgresMcpConfig();
    const pool = createMcpPool();
    await migrateMcpDatabase(pool);
    const store = new PgMcpStore(pool);
    await store.healthCheck();
    audit = store;
    approvals = store;
    contributions = store;
    vault = new EncryptedPgSecretVault(pool);
    healthCheck = () => store.healthCheck();
  } else if (storeMode === 'file') {
    validateMcpStoreConfig();
    audit = new FileAuditLogger();
    approvals = new FileApprovalStore();
    contributions = new FileContributionSink();
    healthCheck = async () => undefined;
  } else {
    throw new Error(`Unsupported MCP_STORE=${storeMode}; expected postgres or file.`);
  }
  const runtime = createRuntime({ audit, approvals, contributions, ...(vault ? { vault } : {}) });
  const registry = new MCPRegistry();
  const connectors = enabledConnectors();
  if (connectors.has('github')) await registerGithubPlugin({ runtime, registry, workspaceId: WS });
  if (connectors.has('gitlab')) await registerGitLabPlugin({ runtime, registry });
  if (connectors.has('bitbucket')) await registerBitbucketPlugin({ runtime, registry });
  if (connectors.has('notion')) await registerNotionPlugin({ runtime, registry, workspaceId: WS });
  if (connectors.has('figma')) await registerFigmaPlugin({ runtime, registry, workspaceId: WS });
  if (connectors.has('web3')) await registerWeb3Plugin({ runtime, registry, workspaceId: WS });
  if (connectors.has('ai')) await registerAiPlugin({ runtime, registry, workspaceId: WS });
  const client = new MCPClient(registry);

  const service: TechitService = {
    workspaceId: WS,
    listTools: () => client.listTools(),
    audit: async (workspaceId) => workspaceId
      ? [...await audit.entriesForWorkspace(workspaceId)]
      : [...await audit.entries()],
    contributions: async (workspaceId) => workspaceId
      ? [...await contributions.eventsForWorkspace(workspaceId)]
      : [...await contributions.allEvents()],
    approvals: async (workspaceId) => workspaceId
      ? await approvals.listForWorkspace(workspaceId)
      : await approvals.allApprovals(),
    healthCheck,
    invoke: (plugin, tool, params, actor) => client.invoke(plugin, tool, params, toContext(actor)),
    approve: async (requestId, actor = { id: 'founder', role: 'owner', kind: 'human', workspaceId: WS }) => {
      const req = await approvals.get(requestId);
      if (!req) return { approved: false, reason: 'not_found' };
      const ctx = toContext(actor);
      if (ctx.actor.kind !== 'human') return { approved: false, reason: 'human_required' };
      if (!['admin', 'owner'].includes(ctx.actor.role)) return { approved: false, reason: 'insufficient_role' };
      if (req.workspaceId !== ctx.actor.workspaceId) return { approved: false, reason: 'workspace_mismatch' };
      if (req.status !== 'pending') return { approved: false, reason: `already_${req.status}` };
      try {
        await approvals.decide({
          requestId,
          decidedBy: ctx.actor.id,
          status: 'approved',
          decidedAt: new Date().toISOString(),
        });
      } catch {
        const current = await approvals.get(requestId);
        return { approved: false, reason: `already_${current?.status ?? 'changed'}` };
      }
      return { approved: true };
    },
  };

  // Demo seed activity is opt-in and forbidden in production/staging. An audit
  // log must contain only real actions unless an operator explicitly launches
  // a local demo.
  if (process.env.MCP_SEED_DEMO_ACTIVITY === 'true' && (await audit.entries()).length === 0) {
    await service.invoke('github', 'list_repositories', {});
    await service.invoke('github', 'list_issues', { repo: 'acme/app' });
    await service.invoke(
      'github',
      'create_pull_request',
      { repo: 'acme/app', head: 'feat/login', base: 'main', title: 'Add login flow' },
      { id: 'coding-agent', kind: 'agent', role: 'editor', toolsAllowed: ['github.create_pull_request'] },
    );
    // One read per new connector so every plugin appears in the demo feeds.
    await service.invoke('notion', 'search', { query: 'roadmap' });
    await service.invoke('figma', 'get_file', { file_key: 'demo123' });
    await service.invoke('web3', 'get_balance', { address: '0x1234567890abcdef1234567890abcdef12345678' });
    await service.invoke(
      'ai',
      'review_code',
      { code: 'const x: any = 1;', language: 'typescript' },
      { id: 'founder', kind: 'human', role: 'editor' },
    );
  }

  return service;
}

let singleton: Promise<TechitService> | undefined;

export function getTechitService(): Promise<TechitService> {
  if (!singleton) singleton = build();
  return singleton;
}

function validateProductionConfig(): void {
  if (!isProductionLike()) return;
  if (process.env.MCP_STORE !== 'postgres') {
    throw new Error('MCP_STORE=postgres is required in production/staging.');
  }
  if (process.env.MCP_ALLOW_STUB_CONNECTORS === 'true') {
    throw new Error('MCP_ALLOW_STUB_CONNECTORS=true is forbidden in production/staging.');
  }
  if (process.env.MCP_SEED_DEMO_ACTIVITY === 'true') {
    throw new Error('MCP_SEED_DEMO_ACTIVITY=true is forbidden in production/staging.');
  }
  const connectors = enabledConnectors();
  if (connectors.size === 0) throw new Error('MCP_ENABLED_CONNECTORS must enable at least one production connector.');
  const requirements: Record<ConnectorName, { mode: string; vars: string[] }> = {
    github: { mode: 'GITHUB_CONNECTOR_MODE', vars: ['MCP_GITHUB_TOKEN'] },
    gitlab: { mode: 'GITLAB_CONNECTOR_MODE', vars: ['MCP_GITLAB_TOKEN'] },
    bitbucket: { mode: 'BITBUCKET_CONNECTOR_MODE', vars: ['MCP_BITBUCKET_TOKEN'] },
    notion: { mode: 'NOTION_CONNECTOR_MODE', vars: ['NOTION_TOKEN'] },
    figma: { mode: 'FIGMA_CONNECTOR_MODE', vars: ['FIGMA_TOKEN'] },
    web3: { mode: 'WEB3_CONNECTOR_MODE', vars: ['SIWE_EXPECTED_DOMAIN', 'SIWE_EXPECTED_URI', 'SIWE_EXPECTED_CHAIN_ID'] },
    ai: { mode: 'AI_HARNESS_CONNECTOR_MODE', vars: ['AI_ROUTER_URL', 'AI_ROUTER_TOKEN'] },
  };
  for (const connector of connectors) {
    const requirement = requirements[connector];
    if (process.env[requirement.mode] !== 'real') {
      throw new Error(`${requirement.mode}=real is required for enabled production connector ${connector}.`);
    }
    for (const name of requirement.vars) {
      if (!process.env[name]) throw new Error(`${name} is required for enabled production connector ${connector}.`);
    }
  }
  if (connectors.has('web3') && !process.env.WEB3_RPC_URL && !process.env.ALCHEMY_API_KEY) {
    throw new Error('WEB3_RPC_URL or ALCHEMY_API_KEY is required for the production web3 connector.');
  }
  for (const name of ['AI_ROUTER_URL', 'WEB3_RPC_URL']) {
    const value = process.env[name];
    if (value && new URL(value).protocol !== 'https:') throw new Error(`${name} must use https in production/staging.`);
  }
}

function isProductionLike(): boolean {
  return ['production', 'staging'].includes((process.env.NODE_ENV || '').toLowerCase());
}

function enabledConnectors(): Set<ConnectorName> {
  const raw = process.env.MCP_ENABLED_CONNECTORS;
  if (!raw && !isProductionLike()) return new Set(CONNECTOR_NAMES);
  if (!raw) throw new Error('MCP_ENABLED_CONNECTORS is required in production/staging.');
  const values = raw.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const invalid = values.filter((value) => !CONNECTOR_NAMES.includes(value as ConnectorName));
  if (invalid.length) throw new Error(`Unknown MCP connector(s): ${invalid.join(', ')}`);
  return new Set(values as ConnectorName[]);
}
