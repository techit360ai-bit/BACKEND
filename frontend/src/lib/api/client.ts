// frontend/src/lib/api/client.ts
//
// Tiny typed fetch client for the ai-router backend. No runtime deps (the project
// can't add packages in some environments), just native fetch + a fallback helper.

import { apiUrl, API_FALLBACK_ENABLED } from "./config";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

/** Optional auth token getter — wire to real auth later. */
let authTokenGetter: (() => string | null) | null = null;
export function setAuthTokenGetter(fn: () => string | null) {
  authTokenGetter = fn;
}

function headers(extra?: HeadersInit): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = authTokenGetter?.();
  if (token) h.Authorization = `Bearer ${token}`;
  return { ...h, ...(extra as Record<string, string>) };
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`, data);
  }
  return data as T;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "GET",
    headers: headers(init?.headers),
    ...init,
  });
  return parse<T>(res);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: headers(init?.headers),
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
  return parse<T>(res);
}

/**
 * Run an API call, falling back to bundled mock data on failure (unless strict
 * mode is on). Keeps dashboards rendering when the backend is unavailable.
 *
 *   const holdings = await withFallback(() => fetchEquity(), equityHoldings);
 */
export async function withFallback<T>(
  call: () => Promise<T>,
  fallback: T | (() => T),
  label?: string,
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!API_FALLBACK_ENABLED) throw err;
    if (typeof console !== "undefined") {
      console.warn(`[api] ${label ?? "request"} failed; using mock fallback`, err);
    }
    return typeof fallback === "function" ? (fallback as () => T)() : fallback;
  }
}
