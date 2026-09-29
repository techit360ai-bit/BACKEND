/**
 * TechIT service singleton — builds the plugin runtime once and exposes the
 * three observable surfaces (tools, audit, contributions) plus invoke/approve
 * actions for an HTTP layer. No web framework imported here; the backend mounts
 * these functions onto its own Express app (see ./mount.ts).
 */

import type { Actor, AgentDefinition, Role } from '@techit/core';
import { createRuntime, type CallContext, type Result } from '@techit/plugin-sdk';
import { InMemorySecretVault, type SecretVault } from '@techit/infra-secrets';
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

/**
 * How each connector authenticates, and where its credential lives.
 *
 * Every entry mirrors the `TOKEN_KEY`/`RPC_KEY` constant exported by that
 * plugin's `auth.ts` (gitlab and bitbucket share `plugins/git-host`, which uses
 * the bare key `access_token` and does not export a constant). The vault key
 * MUST match, or a credential connected through the API is invisible to the
 * connector that is supposed to read it — `server/__tests__` asserts this for
 * every plugin that does export its key.
 *
 * Credentials are stored per *plugin namespace*, not per workspace. The
 * connectors are process-wide singletons registered once at boot, so a
 * per-workspace credential could not be routed to the right connector anyway.
 * Multi-tenant credential isolation needs the vault handle threaded through
 * `MCPClient.invoke`; until then this is explicitly single-tenant and the
 * connect route is restricted to platform owners/admins.
 */
interface ConnectorCredential {
  /** Vault key inside `secrets://<plugin>/`. */
  key: string;
  /** Human label for the credential. */
  label: string;
  kind: 'oauth_token' | 'api_key' | 'rpc_url';
  /** `<NAME>_CONNECTOR_MODE` — `real` selects the live API over the fake. */
  modeVar: string;
  /** Env var that seeds this credential at boot when the vault is empty. */
  envVar?: string;
  /** True when the tools work with no credential at all (fake API / public reads). */
  optional: boolean;
}

/** Exported for the drift guard in tests/secrets-vault.test.ts. */
export const CONNECTOR_CREDENTIALS: Record<ConnectorName, ConnectorCredential> = {
  github: { key: 'oauth_access_token', label: 'GitHub token', kind: 'oauth_token', modeVar: 'GITHUB_CONNECTOR_MODE', envVar: 'MCP_GITHUB_TOKEN', optional: false },
  gitlab: { key: 'access_token', label: 'GitLab token', kind: 'api_key', modeVar: 'GITLAB_CONNECTOR_MODE', envVar: 'MCP_GITLAB_TOKEN', optional: false },
  bitbucket: { key: 'access_token', label: 'Bitbucket token', kind: 'api_key', modeVar: 'BITBUCKET_CONNECTOR_MODE', envVar: 'MCP_BITBUCKET_TOKEN', optional: false },
  notion: { key: 'access_token', label: 'Notion integration token', kind: 'api_key', modeVar: 'NOTION_CONNECTOR_MODE', envVar: 'NOTION_TOKEN', optional: false },
  figma: { key: 'access_token', label: 'Figma personal access token', kind: 'api_key', modeVar: 'FIGMA_CONNECTOR_MODE', envVar: 'FIGMA_TOKEN', optional: false },
  web3: { key: 'rpc_url', label: 'Sepolia RPC URL', kind: 'rpc_url', modeVar: 'WEB3_CONNECTOR_MODE', envVar: 'WEB3_RPC_URL', optional: true },
  ai: { key: 'ai_router_token', label: 'ai-router token', kind: 'api_key', modeVar: 'AI_HARNESS_CONNECTOR_MODE', envVar: 'AI_ROUTER_TOKEN', optional: true },
};

/** What a connector looks like from outside — never includes the secret itself. */
export interface ConnectionStatus {
  plugin: string;
  label: string;
  kind: ConnectorCredential['kind'];
  /** True when a credential is stored in the vault. */
  connected: boolean;
  /** Where the credential came from: the vault, the environment, or nowhere. */
  source: 'vault' | 'env' | 'none';
  /** ISO expiry, or NEVER_EXPIRES when it does not expire. Absent when unconnected. */
  expiresAt?: string;
  /** Whether invocation hits the live provider or the deterministic fake. */
  mode: 'real' | 'fake';
  /** True when the connector works without a credential. */
  optional: boolean;
  /** Set by disconnect when the env var will re-seed this credential on restart. */
  envFallback?: boolean;
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
  /**
   * Dev-only: populate a caller's own workspace with the demo feeds the first
   * time it is seen, so a signed-in user has something to look at. No-op unless
   * MCP_SEED_DEMO_ACTIVITY=true (forbidden in production), and memoized per
   * workspace, so it is cheap enough to call on every request.
   */
  ensureDemoActivity(workspaceId?: string): Promise<void>;
  /** Per-connector credential status. Never returns secret material. */
  connections(): Promise<ConnectionStatus[]>;
  /** Store a connector credential in its scoped vault namespace. */
  connect(plugin: string, credential: string, ttlSeconds?: number): Promise<ConnectResult>;
  /** Remove a connector credential from its scoped vault namespace. */
  disconnect(plugin: string): Promise<DisconnectResult>;
}

export type ConnectResult =
  | { ok: true; connection: ConnectionStatus }
  | { ok: false; error: string };

export type DisconnectResult =
  | { ok: true; connection: ConnectionStatus; removed: boolean; envFallback: boolean }
  | { ok: false; error: string };


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

/** Opt-in local demo data. validateProductionConfig() forbids this in prod. */
const demoSeedEnabled = () => process.env.MCP_SEED_DEMO_ACTIVITY === 'true';

/**
 * Writes the demo activity into one workspace, across every connector.
 *
 * Every invoke passes the workspace explicitly. The actor default in
 * toContext() falls back to WS, which would file a real caller's demo rows
 * under a workspace they cannot read — the feed routes all filter by caller
 * workspace, so the seed would run and still show as empty.
 */
async function seedDemoActivity(service: TechitService, workspaceId: string): Promise<void> {
  const human: ActorInput = { kind: 'human', role: 'owner', workspaceId };
  await service.invoke('github', 'list_repositories', {}, human);
  await service.invoke('github', 'list_issues', { repo: 'acme/app' }, human);
  await service.invoke(
    'github',
    'create_pull_request',
    { repo: 'acme/app', head: 'feat/login', base: 'main', title: 'Add login flow' },
    { id: 'coding-agent', kind: 'agent', role: 'editor', toolsAllowed: ['github.create_pull_request'], workspaceId },
  );
  // One read per new connector so every plugin appears in the demo feeds.
  await service.invoke('notion', 'search', { query: 'roadmap' }, human);
  await service.invoke('figma', 'get_file', { file_key: 'demo123' }, human);
  await service.invoke('web3', 'get_balance', { address: '0x1234567890abcdef1234567890abcdef12345678' }, human);
  await service.invoke(
    'ai',
    'review_code',
    { code: 'const x: any = 1;', language: 'typescript' },
    { id: 'founder', kind: 'human', role: 'editor', workspaceId },
  );
}

/** Workspaces already offered the lazy demo seed in this process. */
const seededWorkspaces = new Set<string>();

async function build(): Promise<TechitService> {
  validateProductionConfig();
  const storeMode = (process.env.MCP_STORE || (isProductionLike() ? 'postgres' : 'file')).toLowerCase();
  let audit: FileAuditLogger | PgMcpStore;
  let approvals: FileApprovalStore | PgMcpStore;
  let contributions: FileContributionSink | PgMcpStore;
  let healthCheck: () => Promise<void>;
  // Always concrete. In file mode the service used to leave this undefined and
  // let createRuntime() fall back to its own InMemorySecretVault — so the
  // service held no handle on the vault the plugins actually read, and could
  // not have implemented connect/disconnect at all. Same instance now.
  let vault: SecretVault;
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
    vault = new InMemorySecretVault();
    healthCheck = async () => undefined;
  } else {
    throw new Error(`Unsupported MCP_STORE=${storeMode}; expected postgres or file.`);
  }
  const runtime = createRuntime({ audit, approvals, contributions, vault });
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
    ensureDemoActivity: async (workspaceId?: string) => {
      const ws = workspaceId || WS;
      if (!demoSeedEnabled() || seededWorkspaces.has(ws)) return;
      seededWorkspaces.add(ws);
      if ((await audit.entriesForWorkspace(ws)).length > 0) return;
      await seedDemoActivity(service, ws);
    },
    connections: async () => {
      const enabled = enabledConnectors();
      return Promise.all(
        CONNECTOR_NAMES.filter((name) => enabled.has(name))
          .map((name) => connectionStatusFor(vault, name)),
      );
    },
    connect: async (plugin, credential, ttlSeconds) => {
      const name = asConnector(plugin);
      if (!name) return { ok: false, error: 'unknown_connector' };
      if (!enabledConnectors().has(name)) return { ok: false, error: 'connector_not_enabled' };
      const spec = CONNECTOR_CREDENTIALS[name];
      const value = typeof credential === 'string' ? credential.trim() : '';
      if (!value) return { ok: false, error: 'credential_required' };
      // Bound the payload before it reaches the vault, so a paste accident or a
      // request-body flood cannot write megabytes of junk into a secret row.
      if (value.length > 4096) return { ok: false, error: 'credential_too_long' };
      if (spec.kind === 'rpc_url') {
        let parsed: URL;
        try {
          parsed = new URL(value);
        } catch {
          return { ok: false, error: 'rpc_url_invalid' };
        }
        // A provider URL is a credential: over plain http the key travels in
        // the clear on every request. Production already requires https.
        if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, error: 'rpc_url_invalid_scheme' };
        if (isProductionLike() && parsed.protocol !== 'https:') return { ok: false, error: 'rpc_url_requires_https' };
      }
      const ttl = Number.isFinite(ttlSeconds) && (ttlSeconds as number) > 0 ? Number(ttlSeconds) : 0;
      await vault.scopeTo(name).set(spec.key, value, ttl);
      return { ok: true, connection: await connectionStatusFor(vault, name) };
    },
    disconnect: async (plugin) => {
      const name = asConnector(plugin);
      if (!name) return { ok: false, error: 'unknown_connector' };
      const spec = CONNECTOR_CREDENTIALS[name];
      const removed = await vault.scopeTo(name).delete(spec.key);
      const connection = await connectionStatusFor(vault, name);
      // The env var is read at authenticate() time, so a restart re-seeds it.
      // Saying so is the difference between "disconnected" and "disconnected
      // until the next boot, then silently back" — the operator needs to know.
      const envFallback = Boolean(spec.envVar && process.env[spec.envVar]);
      return {
        ok: true,
        connection: { ...connection, envFallback },
        removed,
        envFallback,
      };
    },
  };

  // Demo seed activity is opt-in and forbidden in production/staging. An audit
  // log must contain only real actions unless an operator explicitly launches
  // a local demo.
  //
  // This boot seed only covers WS. Real callers authenticate into their own
  // workspace (app.js resolveActor derives `user-<profileId>`), and every feed
  // route filters by caller workspace — so this alone leaves a signed-in user
  // staring at empty panels. ensureDemoActivity() below covers them.
  if (demoSeedEnabled() && (await audit.entries()).length === 0) {
    await seedDemoActivity(service, WS);
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

/** Narrow an untrusted plugin string from a request body to a known connector. */
function asConnector(value: unknown): ConnectorName | undefined {
  return typeof value === 'string' && (CONNECTOR_NAMES as readonly string[]).includes(value)
    ? (value as ConnectorName)
    : undefined;
}

/**
 * Read a connector's credential state out of the vault.
 *
 * Returns presence and expiry only — never the value. There is deliberately no
 * route that reads a stored secret back out to a caller; the connectors resolve
 * credentials server-side at invoke time, so a leaked browser session cannot
 * exfiltrate a provider token through this API.
 */
async function connectionStatusFor(vault: SecretVault, name: ConnectorName): Promise<ConnectionStatus> {
  const spec = CONNECTOR_CREDENTIALS[name];
  const lease = await vault.scopeTo(name).get(spec.key);
  const mode: ConnectionStatus['mode'] = process.env[spec.modeVar] === 'real' ? 'real' : 'fake';
  const base = { plugin: name, label: spec.label, kind: spec.kind, mode, optional: spec.optional };
  if (lease) {
    return { ...base, connected: true, source: 'vault', expiresAt: lease.expiresAt };
  }
  // No vault entry, but the environment supplies one: the connector re-seeds it
  // from that var at authenticate() time, so this reads as provisioned — it
  // just is not in the vault *right now* (fresh boot, or after a disconnect).
  return {
    ...base,
    connected: false,
    source: spec.envVar && process.env[spec.envVar] ? 'env' : 'none',
  };
}
