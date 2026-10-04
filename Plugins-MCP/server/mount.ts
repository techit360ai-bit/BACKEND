/**
 * Mounts the TechIT plugin API onto an existing Express app. The backend owns
 * the Express instance (and its json/CORS middleware); this just adds routes,
 * so no web framework is imported from inside the Plugins-MCP workspace.
 *
 *   GET  /api/health
 *   GET  /api/tools           → MCP catalogue (what agents can call)
 *   GET  /api/audit           → immutable audit log
 *   GET  /api/contributions   → execution-intelligence feed
 *   GET  /api/approvals       → approval requests (pending/approved/rejected)
 *   GET  /api/connections     → connector credential status (never the secret)
 *   POST /api/invoke          → { plugin, tool, params } → structured Result
 *   POST /api/approvals/:id/approve → approve then re-invoke client-side
 *   POST /api/connections/:plugin   → store a connector credential (owner/admin)
 *   DELETE /api/connections/:plugin → remove a connector credential (owner/admin)
 *
 * Auth: pass `opts.resolveActor` to gate every route on a verified JWT (or any
 * authenticator the backend chooses). When set, requests that don't produce an
 * actor get 401. When UNSET the mount FAILS CLOSED (503 `auth_not_configured`):
 * it will not honour a body-supplied actor, because that let any caller pick
 * their own role (F7 in the MCP report). Local tooling that genuinely needs the
 * legacy behaviour must opt in explicitly with `allowDevActor: true`, which is
 * refused when NODE_ENV is production/staging.
 */

import type { Role } from '@techit/core';
import { getTechitService } from './techit-service.js';

// Minimal structural types so this file needs no @types/express here.
interface Req {
  body: Record<string, unknown>;
  params: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
}
interface Res {
  json(body: unknown): void;
  status(code: number): Res;
}
interface App {
  get(path: string, handler: (req: Req, res: Res) => void): void;
  post(path: string, handler: (req: Req, res: Res) => void): void;
  delete(path: string, handler: (req: Req, res: Res) => void): void;
}

export interface ResolvedActor {
  actor: {
    id: string;
    kind: 'human' | 'agent';
    role: Role;
    toolsAllowed?: string[];
    workspaceId?: string;
  };
  /** Tenant scope from the auth token. Reserved for future per-workspace routing. */
  workspaceId?: string;
}

export interface MountOptions {
  /**
   * Per-request authenticator. Synchronous or async. Return null to reject the
   * request with 401. Without this option the routes accept body-supplied
   * actors — only suitable for local dev.
   */
  resolveActor?: (req: Req) => ResolvedActor | null | Promise<ResolvedActor | null>;
  /**
   * Explicit, dev-only opt-in to the legacy body-supplied actor. MUST NOT be
   * enabled in production/staging (enforced) and MUST NOT be used by the
   * platform backend. Only for local scripts/tests that have no JWT.
   */
  allowDevActor?: boolean;
  authorizeInvocation?: (input: { resolved: ResolvedActor; plugin: string; tool: string; params: Record<string, unknown> }) => { allowed: true } | { allowed: false; status?: number; error: string } | Promise<{ allowed: true } | { allowed: false; status?: number; error: string }>;
  onSuccessfulInvocation?: (input: { resolved: ResolvedActor; plugin: string; tool: string; params: Record<string, unknown>; data: unknown }) => void | Promise<void>;
}

export async function mountTechitApi(app: App, base = '/api', opts: MountOptions = {}): Promise<void> {
  const svc = await getTechitService();
  const { resolveActor, authorizeInvocation, onSuccessfulInvocation } = opts;
  const allowDevActor = opts.allowDevActor === true
    && !['production', 'staging'].includes((process.env.NODE_ENV || '').toLowerCase());

  async function gate(req: Req, res: Res): Promise<ResolvedActor | null> {
    if (!resolveActor) {
      // Fail closed: never trust a body-declared actor. A body-supplied role is
      // exactly the footgun that let a caller claim `owner` (F7). Only an
      // explicit dev opt-in restores a fixed, non-caller-controlled actor.
      if (!allowDevActor) {
        res.status(503).json({
          ok: false,
          error: { code: 'auth_not_configured', error: 'Authentication is not configured for this mount.' },
        });
        return null;
      }
      return { actor: { id: 'dev-actor', kind: 'human', role: 'owner' } };
    }
    const resolved = await resolveActor(req);
    if (!resolved) {
      res.status(401).json({
        ok: false,
        error: { code: 'unauthenticated', error: 'Missing or invalid token' },
      });
      return null;
    }
    return resolved;
  }

  app.get(`${base}/health`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    const workspaceId = resolved.workspaceId ?? resolved.actor.workspaceId ?? svc.workspaceId;
    await svc.healthCheck();
    // NOTE: demo seeding used to run here. A health/readiness probe MUST NOT
    // perform writes, so seeding moved to an explicit dev bootstrap call
    // (techit-service.ensureDemoActivity, invoked by the local dev entrypoint).
    res.json({
      ok: true,
      workspaceId,
      // What the server actually resolved. The dashboard used to offer a role
      // <select> whose value resolveActor overwrote, which taught callers
      // something false about their own authority; this is the real answer.
      actor: { id: resolved.actor.id, kind: resolved.actor.kind, role: resolved.actor.role },
    });
  });
  app.get(`${base}/tools`, async (req, res) => {
    if (!(await gate(req, res))) return;
    res.json(svc.listTools());
  });

  // Explicit, dev-only demo seeding. A health probe must never write, so the
  // convenience that used to live on /health is now a deliberate call. It is a
  // no-op unless MCP_SEED_DEMO_ACTIVITY=true (forbidden in production/staging
  // by validateProductionConfig) and it only ever seeds the caller's workspace.
  app.post(`${base}/dev/seed`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    const workspaceId = resolved.workspaceId ?? resolved.actor.workspaceId ?? svc.workspaceId;
    try {
      await svc.ensureDemoActivity(workspaceId);
    } catch {
      /* seeding is best-effort */
    }
    res.json({ ok: true, workspaceId, seeded: process.env.MCP_SEED_DEMO_ACTIVITY === 'true' });
  });
  app.get(`${base}/audit`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    res.json(await svc.audit(resolved.workspaceId ?? resolved.actor.workspaceId));
  });
  app.get(`${base}/contributions`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    res.json(await svc.contributions(resolved.workspaceId ?? resolved.actor.workspaceId));
  });
  app.get(`${base}/approvals`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    res.json(await svc.approvals(resolved.workspaceId ?? resolved.actor.workspaceId));
  });

  app.post(`${base}/invoke`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    const { plugin, tool, params } = req.body as {
      plugin?: string;
      tool?: string;
      params?: unknown;
    };
    if (!plugin || !tool) {
      res.status(400).json({ ok: false, error: { code: 'invalid_input', error: 'plugin and tool are required' } });
      return;
    }
    const normalizedParams = params && typeof params === 'object' && !Array.isArray(params) ? params as Record<string, unknown> : {};
    // Fail closed: without an explicit authorizer the mount must not execute
    // tools. A caller that genuinely wants unrestricted dev use has to opt in
    // by supplying an authorizer that returns allowed.
    if (!authorizeInvocation) {
      res.status(403).json({ ok: false, error: { code: 'authorization_not_configured', error: 'Tool authorization is not configured' } });
      return;
    }
    const decision = await authorizeInvocation({ resolved, plugin, tool, params: normalizedParams });
    if (!decision.allowed) {
      res.status(decision.status || 403).json({ ok: false, error: { code: 'permission_denied', error: decision.error } });
      return;
    }
    const result = await svc.invoke(plugin, tool, normalizedParams, resolved.actor);
    if (result.ok && onSuccessfulInvocation) await onSuccessfulInvocation({ resolved, plugin, tool, params: normalizedParams, data: result.data });
    res.json(result);
  });

  app.post(`${base}/approvals/:id/approve`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    const requestId = req.params.id;
    if (!requestId) {
      res.status(400).json({ approved: false, reason: 'missing_request_id' });
      return;
    }
    const out = await svc.approve(requestId, {
      ...resolved.actor,
      workspaceId: resolved.workspaceId ?? resolved.actor.workspaceId,
    });
    if (!out.approved) {
      const status = out.reason === 'not_found' ? 404 : 403;
      res.status(status).json(out);
      return;
    }
    res.json(out);
  });

  app.get(`${base}/connections`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    const workspaceId = resolved.workspaceId ?? resolved.actor.workspaceId ?? svc.workspaceId;
    res.json(await svc.connections(workspaceId));
  });

  app.post(`${base}/connections/:plugin`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    if (!requireOperator(resolved, res)) return;
    const workspaceId = resolved.workspaceId ?? resolved.actor.workspaceId ?? svc.workspaceId;
    const { credential, ttlSeconds } = req.body as { credential?: unknown; ttlSeconds?: unknown };
    const out = await svc.connect(workspaceId, req.params.plugin ?? '', credential as string, Number(ttlSeconds), resolved.actor.id);
    if (!out.ok) {
      res.status(out.error === 'unknown_connector' ? 404 : 400).json(out);
      return;
    }
    res.json(out);
  });

  app.delete(`${base}/connections/:plugin`, async (req, res) => {
    const resolved = await gate(req, res);
    if (!resolved) return;
    if (!requireOperator(resolved, res)) return;
    const workspaceId = resolved.workspaceId ?? resolved.actor.workspaceId ?? svc.workspaceId;
    const out = await svc.disconnect(workspaceId, req.params.plugin ?? '');
    if (!out.ok) {
      res.status(out.error === 'unknown_connector' ? 404 : 400).json(out);
      return;
    }
    res.json(out);
  });
}

/**
 * Connector credentials are workspace-scoped (ADR-1). Managing one changes what
 * every invocation in *that workspace* uses, so it takes the same bar as
 * approving a destructive tool: a human at admin or owner in the acting
 * workspace. Agents can never do it, and it can never touch another workspace.
 */
function requireOperator(resolved: ResolvedActor, res: Res): boolean {
  const { actor } = resolved;
  if (actor.kind !== 'human' || !['admin', 'owner'].includes(actor.role)) {
    res.status(403).json({
      ok: false,
      error: {
        code: 'permission_denied',
        error: 'Connector credentials can only be managed by a human admin or owner.',
      },
    });
    return false;
  }
  return true;
}
