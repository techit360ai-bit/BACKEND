// frontend/src/lib/api/training.ts
//
// Adaptive Training — ai-router /api/v1/training/* (time-to-MVP curriculum engine).
// Surfaces the curriculum engine the Academy page never connected to.

import { apiPost, withFallback } from "./client";

export interface CurriculumModule {
  id?: string;
  title: string;
  zone?: string;            // "PRE_MVP" | "POST_MVP"
  estimatedHours?: number;
  status?: string;
  [k: string]: unknown;
}
export interface Curriculum {
  modules: CurriculumModule[];
  durationWeeks?: number;
  [k: string]: unknown;
}

/** POST /api/v1/training/curriculum/generate — adaptive curriculum (time-to-MVP driven). */
export function generateCurriculum(profile: Record<string, unknown>): Promise<Curriculum | null> {
  return withFallback(
    () => apiPost<Curriculum>("/training/curriculum/generate", profile),
    () => null,
    "generate curriculum",
  );
}

/** POST /api/v1/training/progress/update — mark a module complete / update progress. */
export function updateTrainingProgress(body: Record<string, unknown>): Promise<{ ok?: boolean } | null> {
  return withFallback(
    () => apiPost<{ ok?: boolean }>("/training/progress/update", body),
    () => ({ ok: true }),
    "update training progress",
  );
}
