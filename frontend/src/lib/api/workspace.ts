// frontend/src/lib/api/workspace.ts
//
// Workspace AI — ai-router /api/v1/workspace/* (task suggestions, code review,
// sprint planning). For the Workspace MCP console (see new-frontend repo PR #6).

import { apiPost, withFallback } from "./client";

export interface TaskSuggestions {
  suggestions?: unknown;
  next_actions?: unknown;
  [k: string]: unknown;
}

/** POST /api/v1/workspace/tasks/suggest */
export function suggestTasks(workspaceData: Record<string, unknown>): Promise<TaskSuggestions | null> {
  return withFallback(
    () => apiPost<TaskSuggestions>("/workspace/tasks/suggest", workspaceData),
    () => null,
    "suggest tasks",
  );
}

export interface CodeReview {
  review?: unknown;
  cost?: number;
  [k: string]: unknown;
}

/** POST /api/v1/workspace/code/review — Body: { code, language, context } */
export function reviewCode(payload: Record<string, unknown>): Promise<CodeReview | null> {
  return withFallback(
    () => apiPost<CodeReview>("/workspace/code/review", payload),
    () => null,
    "code review",
  );
}

/** POST /api/v1/workspace/sprint/plan */
export function planSprint(sprintData: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return withFallback(
    () => apiPost<Record<string, unknown>>("/workspace/sprint/plan", sprintData),
    () => null,
    "plan sprint",
  );
}
