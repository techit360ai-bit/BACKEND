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
 *   POST /api/invoke          → { plugin, tool, params, actor? } → structured Result
 *   POST /api/approvals/:id/approve → { decidedBy? } → approve then re-invoke client-side
 */

import { getTechitService } from './techit-service.js';

// Minimal structural types so this file needs no @types/express here.
interface Req {
  body: Record<string, unknown>;
  params: Record<string, string>;
}
interface Res {
  json(body: unknown): void;
  status(code: number): Res;
}
interface App {
  get(path: string, handler: (req: Req, res: Res) => void): void;
  post(path: string, handler: (req: Req, res: Res) => void): void;
}

export async function mountTechitApi(app: App, base = '/api'): Promise<void> {
  const svc = await getTechitService();

  app.get(`${base}/health`, (_req, res) => res.json({ ok: true, workspaceId: svc.workspaceId }));
  app.get(`${base}/tools`, (_req, res) => res.json(svc.listTools()));
  app.get(`${base}/audit`, (_req, res) => res.json(svc.audit()));
  app.get(`${base}/contributions`, (_req, res) => res.json(svc.contributions()));
  app.get(`${base}/approvals`, (_req, res) => res.json(svc.approvals()));

  app.post(`${base}/invoke`, async (req, res) => {
    const { plugin, tool, params, actor } = req.body as {
      plugin?: string;
      tool?: string;
      params?: unknown;
      actor?: Parameters<typeof svc.invoke>[3];
    };
    if (!plugin || !tool) {
      res.status(400).json({ ok: false, error: { code: 'invalid_input', error: 'plugin and tool are required' } });
      return;
    }
    const result = await svc.invoke(plugin, tool, params ?? {}, actor);
    res.json(result);
  });

  app.post(`${base}/approvals/:id/approve`, async (req, res) => {
    const decidedBy = typeof req.body?.decidedBy === 'string' ? req.body.decidedBy : undefined;
    const out = await svc.approve(req.params.id, decidedBy);
    res.json(out);
  });
}
