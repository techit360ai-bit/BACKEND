// frontend/src/lib/api/projects.ts
//
// Founder projects (multi-venture portfolio) — ai-router /api/v1/founder/projects.
// Enables a founder to run/analyze MULTIPLE separate startups.

import { apiGet, apiPost, withFallback } from "./client";

export interface FounderProject {
  id: string;
  title: string;
  tagline: string;
  industry: string;
  stage: string;
  isPrimary: boolean;
  gsisScore: number;
  hasWorkspace: boolean;
}

export const FALLBACK_PROJECTS: FounderProject[] = [
  { id: "proj_demo_001", title: "AI Task Manager", tagline: "Execution OS for builders",
    industry: "saas", stage: "mvp", isPrimary: true, gsisScore: 88, hasWorkspace: true },
  { id: "proj_demo_002", title: "MicroMint", tagline: "Stablecoin rails for SMEs",
    industry: "fintech", stage: "idea", isPrimary: false, gsisScore: 72, hasWorkspace: false },
];

/** GET /api/v1/founder/projects — the founder's portfolio of ventures. */
export function fetchFounderProjects(): Promise<FounderProject[]> {
  return withFallback(
    async () => (await apiGet<{ projects: FounderProject[] }>("/founder/projects")).projects,
    FALLBACK_PROJECTS,
    "founder projects",
  );
}

/** POST /api/v1/founder/projects — create a new venture. */
export function createFounderProject(
  body: { title: string; tagline?: string; industry?: string; stage?: string },
): Promise<{ ok: boolean; project?: FounderProject; error?: string }> {
  return withFallback(
    () => apiPost<{ ok: boolean; project?: FounderProject }>("/founder/projects", body),
    () => ({
      ok: true,
      project: {
        id: `proj_local_${Date.now()}`, title: body.title, tagline: body.tagline ?? "",
        industry: body.industry ?? "", stage: body.stage ?? "idea",
        isPrimary: false, gsisScore: 0, hasWorkspace: false,
      },
    }),
    "create project",
  );
}
