// frontend/src/lib/api/config.ts
//
// Central config for talking to the ai-router backend
// (github.com/techit360ai-bit/ai-router). The dashboards were previously 100%
// mock; this is the seam that lets them call the real intelligence engine while
// still rendering offline (see client.ts `withFallback`).

/**
 * Base URL of the ai-router FastAPI service.
 * Override per environment with VITE_API_BASE_URL.
 * Default matches the backend dev server (uvicorn main:app --port 8000).
 */
export const API_BASE_URL: string =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

/** API version prefix used by every ai-router endpoint. */
export const API_PREFIX = "/api/v1";

/**
 * When true, network failures fall back to bundled mock data instead of throwing,
 * so the UI still renders during local dev / when the backend is down.
 * Disable (VITE_API_STRICT=1) to surface real errors in integration testing.
 */
export const API_FALLBACK_ENABLED: boolean =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_API_STRICT !== "1";

/** Build a full URL for an ai-router path (with or without leading slash). */
export function apiUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${clean.startsWith(API_PREFIX) ? "" : API_PREFIX}${clean}`;
}
