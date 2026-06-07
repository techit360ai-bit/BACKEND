// frontend/src/dashboard/workspaces/lib/api/workspaceAI.ts
//
// Workspace AI — talks to the ai-router backend (github.com/techit360ai-bit/ai-router)
// /api/v1/workspace/* : task suggestions, code review, sprint planning.
// Separate from the mock console seam (client.ts); these hit the real engine and
// return null on failure so the console degrades gracefully.

const API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface TaskSuggestions {
  suggestions?: unknown;
  next_actions?: unknown;
}

/** POST /api/v1/workspace/tasks/suggest */
export function suggestTasks(workspaceData: Record<string, unknown>): Promise<TaskSuggestions | null> {
  return post<TaskSuggestions>("/workspace/tasks/suggest", workspaceData);
}

export interface CodeReview {
  review?: unknown;
  cost?: number;
}
/** POST /api/v1/workspace/code/review — Body: { code, language, context } */
export function reviewCode(payload: Record<string, unknown>): Promise<CodeReview | null> {
  return post<CodeReview>("/workspace/code/review", payload);
}

/** POST /api/v1/workspace/sprint/plan */
export function planSprint(sprintData: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return post<Record<string, unknown>>("/workspace/sprint/plan", sprintData);
}

/** Normalize the suggest_tasks response into a flat list of suggestion strings. */
export function flattenSuggestions(res: TaskSuggestions | null): string[] {
  if (!res) return [];
  const out: string[] = [];
  const take = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => {
      if (typeof x === "string") out.push(x);
      else if (x && typeof x === "object" && "title" in x) out.push(String((x as { title: unknown }).title));
      else out.push(String(x));
    });
  };
  take(res.suggestions);
  if (out.length === 0) take(res.next_actions);
  return out.filter(Boolean);
}
