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
 *   POST /api/invoke          → { plugin, tool, params } → structured Result
 *   POST /api/approvals/:id/approve → approve then re-invoke client-side
 *
 * Auth: pass `opts.resolveActor` to gate every route on a verified JWT (or any
 * authenticator the backend chooses). When set, requests that don't produce an
 * actor get 401. When unset, the legacy body.actor + ws-acme fallback runs
 * (DEV ONLY — never enable in production: it lets any caller pick their own
 * role).
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
  authorizeInvocation?: (input: { resolved: ResolvedActor; plugin: string; tool: string; params: Record<string, unknown> }) => { allowed: true } | { allowed: false; status?: number; error: string } | Promise<{ allowed: true } | { allowed: false; status?: number; error: string }>;
  onSuccessfulInvocation?: (input: { resolved: ResolvedActor; plugin: string; tool: string; params: Record<string, unknown>; data: unknown }) => void | Promise<void>;
}

export async function mountTechitApi(app: App, base = '/api', opts: MountOptions = {}): Promise<void> {
  const svc = await getTechitService();
  const { resolveActor, authorizeInvocation, onSuccessfulInvocation } = opts;

  async function gate(req: Req, res: Res): Promise<ResolvedActor | null> {
    if (!resolveActor) {
      // Legacy mode (dev only): construct a permissive actor from body.actor.
      const bodyActor = (req.body?.actor as ResolvedActor['actor'] | undefined) ?? {
        id: 'founder',
        kind: 'human',
        role: 'owner',
      };
      return { actor: bodyActor };
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
    await svc.healthCheck();
    res.json({ ok: true, workspaceId: resolved.workspaceId ?? resolved.actor.workspaceId ?? svc.workspaceId });
  });
  app.get(`${base}/tools`, async (req, res) => {
    if (!(await gate(req, res))) return;
    res.json(svc.listTools());
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
    if (authorizeInvocation) {
      const decision = await authorizeInvocation({ resolved, plugin, tool, params: normalizedParams });
      if (!decision.allowed) {
        res.status(decision.status || 403).json({ ok: false, error: { code: 'permission_denied', error: decision.error } });
        return;
      }
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
}
