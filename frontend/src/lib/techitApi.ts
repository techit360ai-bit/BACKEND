/**
 * Client for the TechIT plugin/MCP API mounted on the Express backend
 * (see backend/src/index.js → mountTechitApi). Base URL is overridable via
 * VITE_TECHIT_API; defaults to the local backend on :3000.
 */

const BASE =
  (import.meta.env.VITE_TECHIT_API as string | undefined) ?? "http://localhost:3000/api";

export interface MCPToolMeta {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  destructive?: boolean;
}
export interface CatalogueEntry {
  plugin: string;
  tool: MCPToolMeta;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorKind: "human" | "agent";
  action: string;
  sourceTool: string;
  resource?: string;
  result: "success" | "failure" | "pending_approval" | "denied";
  workspaceId: string;
}

export interface ContributionEvent {
  id: string;
  kind: string;
  actorId: string;
  actorKind: "human" | "agent";
  sourceTool: string;
  timestamp: string;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  requestedBy: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface PluginError {
  error: string;
  code: string;
  detail?: string;
}
export type InvokeResult =
  | { ok: true; data: unknown }
  | { ok: false; error: PluginError; approvalRequestId?: string };

export interface ActorInput {
  id?: string;
  kind?: "human" | "agent";
  role?: "viewer" | "editor" | "admin" | "owner";
  toolsAllowed?: string[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export const techitApi = {
  baseUrl: BASE,
  health: () => getJson<{ ok: boolean; workspaceId: string }>("/health"),
  tools: () => getJson<CatalogueEntry[]>("/tools"),
  audit: () => getJson<AuditEntry[]>("/audit"),
  contributions: () => getJson<ContributionEvent[]>("/contributions"),
  approvals: () => getJson<ApprovalRequest[]>("/approvals"),
  invoke: (plugin: string, tool: string, params: unknown, actor?: ActorInput) =>
    postJson<InvokeResult>("/invoke", { plugin, tool, params, actor }),
  approve: (id: string, decidedBy = "founder") =>
    postJson<{ approved: boolean }>(`/approvals/${id}/approve`, { decidedBy }),
};
