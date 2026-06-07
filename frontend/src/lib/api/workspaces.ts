// frontend/src/lib/api/workspaces.ts
//
// Workspaces bound to an analyzed venture — ai-router /api/v1/workspaces.
// Powers the Incubation → Workspace handoff and project-scoped workspace context.

import { apiGet, apiPost, withFallback } from "./client";

export interface WorkspaceRef {
  id: string;
  projectId: string;
  name: string;
  status: string;
  seededFromAnalysis: boolean;
}

export interface WorkspaceContext {
  workspaceId: string;
  projectId: string | null;
  venture: Record<string, unknown> | null;
  blueprintAvailable: boolean;
}

/** GET /api/v1/workspaces — the founder's workspaces (each bound to a project). */
export function fetchWorkspaces(): Promise<WorkspaceRef[]> {
  return withFallback(
    async () => (await apiGet<{ workspaces: WorkspaceRef[] }>("/workspaces")).workspaces,
    [],
    "workspaces",
  );
}

/**
 * POST /api/v1/workspaces/provision — create (or fetch) a workspace bound to an
 * analyzed project, seeded from its latest Incubation Hub analysis.
 */
export function provisionWorkspace(
  projectId: string,
  name?: string,
): Promise<{ ok: boolean; workspace?: WorkspaceRef; error?: string }> {
  return withFallback(
    () => apiPost<{ ok: boolean; workspace?: WorkspaceRef }>("/workspaces/provision", { projectId, name }),
    () => ({
      ok: true,
      workspace: {
        id: `ws_${projectId}`, projectId, name: name ?? "Venture Workspace",
        status: "active", seededFromAnalysis: true,
      },
    }),
    "provision workspace",
  );
}

/** GET /api/v1/workspaces/{id}/context — project-scoped context (venture blueprint). */
export function fetchWorkspaceContext(
  workspaceId: string,
  projectId?: string,
): Promise<WorkspaceContext | null> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return withFallback(
    () => apiGet<WorkspaceContext>(`/workspaces/${workspaceId}/context${qs}`),
    () => null,
    "workspace context",
  );
}
