// frontend/src/lib/api/incubation.ts
//
// Incubation Hub pipeline — ai-router /api/v1/incubation/pipeline/run.
// Returns the persisted project_id so the analyzed venture can flow into a workspace.

import { apiPost, withFallback } from "./client";

export interface PipelineBlueprint {
  project_id?: string;
  venture_name?: string;
  unicorn_potential_score?: number;
  investment_score?: number;
  pivot_needed?: boolean;
  [k: string]: unknown;
}

/** POST /api/v1/incubation/pipeline/run — runs the venture pipeline, persists an analysis. */
export function runVenturePipeline(ventureData: Record<string, unknown>): Promise<PipelineBlueprint | null> {
  return withFallback(
    () => apiPost<PipelineBlueprint>("/incubation/pipeline/run", ventureData),
    () => null,
    "venture pipeline",
  );
}
