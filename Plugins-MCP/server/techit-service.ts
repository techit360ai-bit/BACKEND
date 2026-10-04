/**
 * TechIT service singleton — builds the plugin runtime once and exposes the
 * three observable surfaces (tools, audit, contributions) plus invoke/approve
 * actions for an HTTP layer. No web framework imported here; the backend mounts
 * these functions onto its own Express app (see ./mount.ts).
 */

import type { Actor, AgentDefinition, Role } from '@techit/core';
import { createRuntime, type CallContext, type IncubationContext, type Result } from '@techit/plugin-sdk';
import { InMemorySecretVault, type SecretVault } from '@techit/infra-secrets';
import { CREDENTIAL_SCOPES_KEY } from '@techit/plugin-sdk';
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
  /**
   * Incubation/campaign coordinates for this call (WS-H). Resolved server-side
   * from the workspace → project mapping and stamped onto every contribution so
   * the hub and every downstream surface share one execution stream.
   */
  incubation?: IncubationContext;
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

/**
 * Scopes each connector requires, mirroring the manifest `auth.scopes`. Used for
 * resolve-time scope verification (ADR-1 step 3): a stored credential whose
 * recorded scopes do not cover these is denied with `scope_insufficient`.
 */
const REQUIRED_SCOPES: Record<ConnectorName, readonly string[]> = {
  github: ['repo', 'read:user'],
  gitlab: ['api', 'read_repository'],
  bitbucket: ['repository'],
  notion: [],
  figma: [],
  web3: [],
  ai: [],
};

/**
 * Legacy / bootstrap credential mechanism — NOT production architecture
 * (ADR-3). Environment connector tokens are imported into the canonical
 * workspace vault only when `MCP_CREDENTIAL_BOOTSTRAP=import` is set, with
 * telemetry; there is no dynamic per-request fallback to env for agents or
 * user-facing requests. Removal milestone: ENV_CREDENTIAL_REMOVAL_MILESTONE.
 */
export const ENV_CREDENTIAL_REMOVAL_MILESTONE = '2026-12-31';
export const LEGACY_ENV_CREDENTIAL_DEPRECATED = true;

/** Structured, greppable telemetry for the (temporary) bootstrap path. */
export interface CredentialTelemetryEvent {
  event: 'credential_bootstrap_used';
  plugin: string;
  workspaceId: string;
  source: 'legacy-vault' | 'env';
  deprecated: true;
  removalMilestone: string;
  at: string;
}
const credentialTelemetryLog: CredentialTelemetryEvent[] = [];
/** Exposed for tests / ops dashboards. */
export function credentialTelemetry(): readonly CredentialTelemetryEvent[] {
  return credentialTelemetryLog;
}

/** What a connector looks like from outside — never includes the secret itself. */
export interface ConnectionStatus {
  plugin: string;
  label: string;
  kind: ConnectorCredential['kind'];
  /** True when a credential is stored in THIS workspace's canonical vault lane. */
  connected: boolean;
  /**
   * Where the ACTIVE credential comes from. Only `vault` (the workspace lane) is
   * ever used at invoke time. `legacy-bootstrap` means a legacy store exists but
   * is not imported; `none` means there is no credential.
   */
  source: 'vault' | 'legacy-bootstrap' | 'none';
  /** ISO expiry, or NEVER_EXPIRES when it does not expire. Absent when unconnected. */
  expiresAt?: string;
  /** Whether invocation hits the live provider or the deterministic fake. */
  mode: 'real' | 'fake';
  /** True when the connector works without a credential. */
  optional: boolean;
  /**
   * True when a legacy env var / legacy lane credential still exists for this
   * connector. Deprecated: signal to remove it (ADR-3).
   */
  deprecatedEnv?: boolean;
  /** Set by disconnect when a legacy env var could re-seed this credential. */
  envFallback?: boolean;
  /** Granted scope set recorded with the credential (empty when unknown). */
  scopes?: string[];
  /** True when the granted scopes were known and cover what the connector requires. */
  scopesVerified?: boolean;
}

export interface TechitService {
  workspaceId: string;
  listTools(): { plugin: string; tool: unknown }[];
  audit(workspaceId?: string): Promise<unknown[]>;
  contributions(workspaceId?: string): Promise<unknown[]>;
  /**
   * Canonical execution-intelligence VIEW over workspace execution data (WS-H).
   *
   * This is deliberately NOT a scorer and NOT a second trust engine: it is a
   * scope- and role-aware projection of contribution events that every consumer
   * surface (workspace, incubation hub, investor, organization, hackathon) reads
   * the same way. Trust is owned by the canonical Trust Engine; the view only
   * points at the subjects to combine it with (`trustSubjects`).
   */
  executionIntelligence(scope: ExecutionIntelligenceScope): Promise<ExecutionIntelligence>;
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
  /** Per-connector credential status for ONE workspace. Never returns secret material. */
  connections(workspaceId: string): Promise<ConnectionStatus[]>;
  /** Store a connector credential in the workspace's canonical vault lane. */
  connect(workspaceId: string, plugin: string, credential: string, ttlSeconds?: number, actorId?: string, scopes?: string[]): Promise<ConnectResult>;
  /**
   * System import of a credential the platform already obtained (e.g. the
   * GitHub OAuth dance). Not an HTTP route and not operator-gated: it exists so
   * one connection powers both the platform and the MCP tool layer (WS-J4).
   */
  importCredential(workspaceId: string, plugin: string, credential: string, scopes?: string[]): Promise<ConnectResult>;
  /** Remove a connector credential from the workspace's canonical vault lane. */
  disconnect(workspaceId: string, plugin: string): Promise<DisconnectResult>;
}

/** Scope filters for an execution-intelligence view (any consumer can use it). */
export interface ExecutionIntelligenceScope {
  workspaceId: string;
  /**
   * Consumer role shaping the view. Every role reads the same envelope:
   * founder | collaborator | investor | organisation | organisation_admin |
   * hackathon | workspace. Roles differ only in `roleFocus`.
   */
  role?: string;
  /** Narrow to one actor's own execution (e.g. a collaborator's contribution view). */
  actorId?: string;
  projectId?: string;
  organizationId?: string;
  programId?: string;
  cohortId?: string;
  hackathonId?: string;
  /** Look-back window. Clamped to [1h, 90d]. Defaults to 30d. */
  sinceHours?: number;
}

/**
 * A scope-scoped reading of execution activity. Same envelope for every role —
 * roles differ only in `roleFocus`, so no surface gets a private formula.
 */
export interface ExecutionIntelligence {
  scope: {
    workspaceId: string;
    projectId?: string;
    organizationId?: string;
    programId?: string;
    cohortId?: string;
    hackathonId?: string;
  };
  role: string;
  /** Which signal groups this role cares about. Presentation hint, not a score. */
  roleFocus: string[];
  generatedAt: string;
  window: { sinceHours: number; from: string; to: string };
  /** Provenance: a view over execution, with trust owned by the Trust Engine. */
  canonical: { executesFrom: 'workspace'; trustEngine: 'canonical'; graphView: 'execution-reputation' };
  signals: {
    events: number;
    weight: number;
    activeActors: number;
    activeTools: string[];
    projects: string[];
    artifacts: number;
    byKind: Record<string, number>;
    byTool: Record<string, number>;
    byActor: Array<{ actorId: string; actorKind: string; events: number; weight: number }>;
  };
  velocity: { eventsPerDay: number; weightPerDay: number };
  /** Most recent events, newest first — the "what changed" feed for any surface. */
  highlights: Array<{
    id: string;
    kind: string;
    summary: string;
    at: string;
    sourceTool: string;
    actorId: string;
    projectId?: string;
    artifactId?: string;
  }>;
  /**
   * Subjects to combine with the canonical Trust Engine (`publicTrustFor`).
   * This view never computes trust itself.
   */
  trustSubjects: Array<{ kind: 'actor' | 'project'; id: string }>;
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
  // WS-H: incubation coordinates are resolved by the caller (server-side, from
  // the workspace → project mapping) and threaded onto every contextual event.
  const incubation = input?.incubation;
  const actor: Actor = { id, kind, workspaceId, role };
  if (kind === 'agent') {
    const agent: AgentDefinition = {
      id,
      name: id,
      workspaceId,
      toolsAllowed: input?.toolsAllowed ?? [],
      maxRole: role,
    };
    return { actor, agent, resourceWorkspaceId: workspaceId, ...(incubation ? { incubation } : {}) };
  }
  return { actor, resourceWorkspaceId: workspaceId, ...(incubation ? { incubation } : {}) };
}

/** Read the incubation stamp off a contribution event's metadata (WS-H). */
function incubationOf(event: { metadata?: Record<string, unknown> }): Record<string, string | number> {
  const raw = event.metadata && typeof event.metadata === 'object'
    ? (event.metadata as Record<string, unknown>).incubation
    : undefined;
  return raw && typeof raw === 'object' ? (raw as Record<string, string | number>) : {};
}

/** Presentation hint: which signal groups a role cares about. Not a score. */
function roleFocusFor(role: string): string[] {
  switch (role.toLowerCase()) {
    case 'founder': return ['velocity', 'projects', 'artifacts', 'goals', 'stage'];
    case 'collaborator': return ['artifacts', 'tools', 'trust', 'reviews'];
    case 'investor': return ['velocity', 'artifacts', 'trust', 'projects'];
    case 'organisation':
    case 'organization':
    case 'organisation_admin':
    case 'organization_admin': return ['cohorts', 'teams', 'velocity', 'projects'];
    case 'hackathon':
    case 'organizer':
    case 'organiser': return ['submissions', 'teams', 'velocity', 'projects'];
    default: return ['velocity', 'tools', 'projects'];
  }
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
    // WS-H: one scope/role-aware reading of workspace execution for EVERY
    // consumer surface. It does not score trust — `trustSubjects` points at the
    // canonical Trust Engine instead, so no surface grows its own formula.
    executionIntelligence: async (scope) => {
      const sinceHours = Math.max(1, Math.min(24 * 90, Math.round(Number(scope.sinceHours) || 24 * 30)));
      const from = Date.now() - sinceHours * 3600_000;
      const events = scope.workspaceId
        ? await contributions.eventsForWorkspace(scope.workspaceId)
        : await contributions.allEvents();
      const rows = events.filter((event) => {
        const at = new Date(event.timestamp).getTime();
        if (!Number.isFinite(at) || at < from) return false;
        if (scope.actorId && event.actorId !== scope.actorId) return false;
        const incubation = incubationOf(event);
        if (scope.projectId && (event.projectId ?? incubation.projectId) !== scope.projectId) return false;
        if (scope.organizationId && incubation.organizationId !== scope.organizationId) return false;
        if (scope.programId && incubation.programId !== scope.programId) return false;
        if (scope.cohortId && incubation.cohortId !== scope.cohortId) return false;
        if (scope.hackathonId && incubation.hackathonId !== scope.hackathonId) return false;
        return true;
      });
      const role = String(scope.role || 'workspace');
      const byKind: Record<string, number> = {};
      const byTool: Record<string, number> = {};
      const byActorMap = new Map<string, { actorId: string; actorKind: string; events: number; weight: number }>();
      const tools = new Set<string>();
      const projects = new Set<string>();
      let weight = 0;
      let artifacts = 0;
      for (const event of rows) {
        const eventWeight = Number(event.weight || 0);
        weight += eventWeight;
        if (event.artifactId) artifacts += 1;
        byKind[event.kind] = (byKind[event.kind] ?? 0) + 1;
        byTool[event.sourceTool] = (byTool[event.sourceTool] ?? 0) + 1;
        tools.add(event.sourceTool);
        const projectId = event.projectId ?? incubationOf(event).projectId;
        if (typeof projectId === 'string' && projectId) projects.add(projectId);
        const actor = byActorMap.get(event.actorId)
          ?? { actorId: event.actorId, actorKind: event.actorKind, events: 0, weight: 0 };
        actor.events += 1;
        actor.weight += eventWeight;
        byActorMap.set(event.actorId, actor);
      }
      const days = Math.max(1, sinceHours / 24);
      const highlights = [...rows]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20)
        .map((event) => {
          const projectId = event.projectId ?? incubationOf(event).projectId;
          return {
            id: event.id,
            kind: event.kind,
            sourceTool: event.sourceTool,
            actorId: event.actorId,
            at: event.timestamp,
            ...(typeof projectId === 'string' && projectId ? { projectId } : {}),
            ...(event.artifactId ? { artifactId: event.artifactId } : {}),
            summary: `${event.actorId} · ${event.sourceTool} · ${event.kind}${event.artifactId ? ` · ${event.artifactId}` : ''}`,
          };
        });
      const byActor = [...byActorMap.values()].sort((a, b) => b.weight - a.weight);
      const searchable = Object.fromEntries(
        (['projectId', 'organizationId', 'programId', 'cohortId', 'hackathonId'] as const)
          .filter((key) => scope[key])
          .map((key) => [key, scope[key] as string]),
      );
      return {
        scope: { workspaceId: scope.workspaceId, ...searchable },
        role,
        roleFocus: roleFocusFor(role),
        generatedAt: new Date().toISOString(),
        window: { sinceHours, from: new Date(from).toISOString(), to: new Date().toISOString() },
        canonical: { executesFrom: 'workspace', trustEngine: 'canonical', graphView: 'execution-reputation' },
        signals: {
          events: rows.length,
          weight,
          activeActors: byActorMap.size,
          activeTools: [...tools].sort(),
          projects: [...projects].sort(),
          artifacts,
          byKind,
          byTool,
          byActor,
        },
        velocity: { eventsPerDay: rows.length / days, weightPerDay: weight / days },
        highlights,
        trustSubjects: [
          ...byActor.slice(0, 10).map((row) => ({ kind: 'actor' as const, id: row.actorId })),
          ...[...projects].slice(0, 10).map((id) => ({ kind: 'project' as const, id })),
        ],
      };
    },
    approvals: async (workspaceId) => workspaceId
      ? await approvals.listForWorkspace(workspaceId)
      : await approvals.allApprovals(),
    healthCheck,
    invoke: async (plugin, tool, params, actor) => {
      const ctx = toContext(actor);
      // ADR-3: the ONLY path a legacy env credential can enter the canonical
      // workspace lane. It is gated by MCP_CREDENTIAL_BOOTSTRAP=import and emits
      // telemetry; there is deliberately NO dynamic per-request env fallback, so
      // agents and user-facing requests fail closed when the vault is empty.
      await maybeImportLegacyCredential(vault, plugin, ctx.actor.workspaceId);
      return client.invoke(plugin, tool, params, ctx);
    },
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
    connections: async (workspaceId) => {
      const enabled = enabledConnectors();
      return Promise.all(
        CONNECTOR_NAMES.filter((name) => enabled.has(name))
          .map((name) => connectionStatusFor(vault, name, workspaceId)),
      );
    },
    connect: async (workspaceId, plugin, credential, ttlSeconds, actorId, scopes) => {
      const name = asConnector(plugin);
      if (!name) return { ok: false, error: 'unknown_connector' };
      if (!enabledConnectors().has(name)) return { ok: false, error: 'connector_not_enabled' };
      if (!workspaceId) return { ok: false, error: 'workspace_required' };
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
      // CANONICAL workspace lane only (ADR-1/ADR-2). The secret value is written
      // here and never returned; only presence/expiry leave this function.
      await vault.scopeTo(name, workspaceId).set(spec.key, value, ttl);
      // Record granted scopes alongside the secret (metadata, not a secret) so
      // resolve-time scope verification has something to check (ADR-1 step 3).
      if (Array.isArray(scopes)) {
        await vault.scopeTo(name, workspaceId).set(CREDENTIAL_SCOPES_KEY, JSON.stringify(scopes.map(String)), ttl);
      }
      // Non-secret telemetry for the connection record (ADR-1 model fields).
      console.log(JSON.stringify({
        event: 'connector_connected',
        plugin: name,
        workspaceId,
        createdBy: actorId ?? null,
        ttlSeconds: ttl,
        scopes: [],
        at: new Date().toISOString(),
      }));
      return { ok: true, connection: await connectionStatusFor(vault, name, workspaceId) };
    },
    importCredential: async (workspaceId, plugin, credential, scopes) => {
      const name = asConnector(plugin);
      if (!name || !workspaceId) return { ok: false, error: 'unknown_connector' };
      const spec = CONNECTOR_CREDENTIALS[name];
      const value = typeof credential === 'string' ? credential.trim() : '';
      if (!value) return { ok: false, error: 'credential_required' };
      await vault.scopeTo(name, workspaceId).set(spec.key, value, 0);
      if (Array.isArray(scopes)) {
        await vault.scopeTo(name, workspaceId).set(CREDENTIAL_SCOPES_KEY, JSON.stringify(scopes.map(String)), 0);
      }
      console.log(JSON.stringify({
        event: 'connector_imported_from_platform_oauth',
        plugin: name,
        workspaceId,
        scopes: Array.isArray(scopes) ? scopes : [],
        at: new Date().toISOString(),
      }));
      return { ok: true, connection: await connectionStatusFor(vault, name, workspaceId) };
    },
    disconnect: async (workspaceId, plugin) => {
      const name = asConnector(plugin);
      if (!name) return { ok: false, error: 'unknown_connector' };
      if (!workspaceId) return { ok: false, error: 'workspace_required' };
      const spec = CONNECTOR_CREDENTIALS[name];
      const removed = await vault.scopeTo(name, workspaceId).delete(spec.key);
      const connection = await connectionStatusFor(vault, name, workspaceId);
      // A legacy env var re-seeds ONLY through an explicit bootstrap import. The
      // caller must know a "disconnect" is not permanent while that is enabled.
      const envFallback = bootstrapImportEnabled() && Boolean(spec.envVar && process.env[spec.envVar]);
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
  // Per ADR-1/ADR-2/ADR-3 the canonical credential store is the WORKSPACE VAULT,
  // filled by the connect API (and, temporarily, by a gated bootstrap import of
  // legacy env tokens). Production therefore does NOT require env tokens at
  // boot — requiring them would re-establish env as the architecture. Only the
  // connector *mode* and the shared service endpoints remain boot requirements.
  const modes: Record<ConnectorName, string> = {
    github: 'GITHUB_CONNECTOR_MODE',
    gitlab: 'GITLAB_CONNECTOR_MODE',
    bitbucket: 'BITBUCKET_CONNECTOR_MODE',
    notion: 'NOTION_CONNECTOR_MODE',
    figma: 'FIGMA_CONNECTOR_MODE',
    web3: 'WEB3_CONNECTOR_MODE',
    ai: 'AI_HARNESS_CONNECTOR_MODE',
  };
  for (const connector of connectors) {
    if (process.env[modes[connector]] !== 'real') {
      throw new Error(`${modes[connector]}=real is required for enabled production connector ${connector}.`);
    }
  }
  // Shared service endpoints (not per-tenant secrets) still need to be present.
  if (connectors.has('ai') && !process.env.AI_ROUTER_URL) {
    throw new Error('AI_ROUTER_URL is required for the production ai connector.');
  }
  if (process.env.AI_ROUTER_URL && new URL(process.env.AI_ROUTER_URL).protocol !== 'https:') {
    throw new Error('AI_ROUTER_URL must use https in production/staging.');
  }
  // Warn (do not fail) when a legacy env token is still present. Tokens are
  // bootstrap-only; the operator should import then remove them (ADR-3).
  const legacyTokens = Object.values(CONNECTOR_CREDENTIALS)
    .map((spec) => spec.envVar)
    .filter((name): name is string => Boolean(name && process.env[name]));
  if (legacyTokens.length > 0) {
    console.warn(JSON.stringify({
      event: 'legacy_env_credential_present',
      vars: legacyTokens,
      removalMilestone: ENV_CREDENTIAL_REMOVAL_MILESTONE,
      note: 'Deprecated: import into the workspace vault (MCP_CREDENTIAL_BOOTSTRAP=import) then remove.',
    }));
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
/** True only when the operator explicitly enabled the migration bootstrap. */
function bootstrapImportEnabled(): boolean {
  return process.env.MCP_CREDENTIAL_BOOTSTRAP === 'import';
}

/** Does a deprecated legacy (env) credential exist for this connector? */
function legacyEnvPresent(name: ConnectorName): boolean {
  const spec = CONNECTOR_CREDENTIALS[name];
  return Boolean(spec.envVar && process.env[spec.envVar]);
}

/**
 * Copy a legacy credential (legacy vault lane, else env var) into the canonical
 * workspace lane, ONCE, when bootstrap import is explicitly enabled. Emits
 * telemetry and never overwrites a real workspace credential.
 *
 * This is the whole of the "keep temporarily" phase (ADR-3). It is not a
 * runtime fallback: with `MCP_CREDENTIAL_BOOTSTRAP` unset, an empty workspace
 * vault simply fails closed.
 */
async function maybeImportLegacyCredential(
  vault: SecretVault,
  plugin: string,
  workspaceId?: string,
): Promise<boolean> {
  if (!bootstrapImportEnabled() || !workspaceId) return false;
  const name = asConnector(plugin);
  if (!name) return false;
  const spec = CONNECTOR_CREDENTIALS[name];
  // The vault is the source of truth: never clobber an existing credential.
  if (await vault.scopeTo(name, workspaceId).get(spec.key)) return false;

  const legacyLease = await vault.scopeTo(name).get(spec.key);
  const envValue = spec.envVar ? process.env[spec.envVar] : undefined;
  const value = legacyLease?.value ?? envValue;
  if (!value) return false;

  await vault.scopeTo(name, workspaceId).set(spec.key, value, 0);
  const event: CredentialTelemetryEvent = {
    event: 'credential_bootstrap_used',
    plugin: name,
    workspaceId,
    source: legacyLease ? 'legacy-vault' : 'env',
    deprecated: true,
    removalMilestone: ENV_CREDENTIAL_REMOVAL_MILESTONE,
    at: new Date().toISOString(),
  };
  credentialTelemetryLog.push(event);
  console.warn(JSON.stringify(event));
  return true;
}

async function connectionStatusFor(vault: SecretVault, name: ConnectorName, workspaceId: string): Promise<ConnectionStatus> {
  const spec = CONNECTOR_CREDENTIALS[name];
  // If bootstrap import is enabled, reflect a pending migration in status.
  await maybeImportLegacyCredential(vault, name, workspaceId);
  const scoped = vault.scopeTo(name, workspaceId);
  const lease = await scoped.get(spec.key);
  const mode: ConnectionStatus['mode'] = process.env[spec.modeVar] === 'real' ? 'real' : 'fake';
  const base = { plugin: name, label: spec.label, kind: spec.kind, mode, optional: spec.optional };
  if (lease) {
    // Report granted scopes when recorded, and whether they cover what this
    // connector requires. Unknown scopes (opaque pasted token) are flagged, not
    // silently treated as sufficient.
    let scopes: string[] = [];
    const scopeLease = await scoped.get(CREDENTIAL_SCOPES_KEY);
    if (scopeLease?.value) {
      try {
        const parsed = JSON.parse(scopeLease.value);
        if (Array.isArray(parsed)) scopes = parsed.map(String);
      } catch {
        scopes = [];
      }
    }
    const required = REQUIRED_SCOPES[name] ?? [];
    const scopesVerified = scopes.length > 0 && required.every((s) => scopes.includes(s));
    // `deprecatedEnv` tells ops the legacy var is still set and should be removed
    // once the workspace lane holds the credential (ADR-3 removal milestone).
    return {
      ...base,
      connected: true,
      source: 'vault',
      expiresAt: lease.expiresAt,
      scopes,
      scopesVerified,
      ...(legacyEnvPresent(name) ? { deprecatedEnv: true } : {}),
    };
  }
  // No workspace credential. A legacy env var is NOT the active source — it is
  // reported only so ops can see migration work remains.
  return { ...base, connected: false, source: legacyEnvPresent(name) ? 'legacy-bootstrap' : 'none' };
}
