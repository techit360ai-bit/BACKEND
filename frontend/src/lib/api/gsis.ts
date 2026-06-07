// frontend/src/lib/api/gsis.ts
//
// Dashboard intelligence / GSIS — ai-router /api/v1/dashboard/intelligence + /gsis/compute.
// Surfaces the master Global Startup Intelligence Score the frontend never showed.

import { apiGet, apiPost, withFallback } from "./client";

export interface GsisScore {
  gsis: number;
  classification?: string;
  components?: Record<string, number>;
}
export interface DashboardIntelligence {
  gsis: GsisScore | null;
  alerts: { id?: string; type?: string; message: string; severity?: string }[];
  evi?: number;
  [k: string]: unknown;
}

const FALLBACK_INTEL: DashboardIntelligence = {
  // Mirrors the founder Incubation panel's existing sub-scores so the card has
  // sensible values when the backend is unavailable.
  gsis: { gsis: 88, classification: "High Potential", components: { unicorn: 91, marketFit: 88, feasibility: 84 } },
  alerts: [],
};

/** GET /api/v1/dashboard/intelligence — real-time GSIS + alerts for the dashboard. */
export function fetchDashboardIntelligence(): Promise<DashboardIntelligence> {
  return withFallback(
    () => apiGet<DashboardIntelligence>("/dashboard/intelligence"),
    FALLBACK_INTEL,
    "dashboard intelligence",
  );
}

/** POST /api/v1/gsis/compute — compute GSIS from component scores. */
export function computeGsis(componentScores: Record<string, number>): Promise<GsisScore> {
  return withFallback(
    () => apiPost<GsisScore>("/gsis/compute", { component_scores: componentScores }),
    FALLBACK_INTEL.gsis as GsisScore,
    "compute gsis",
  );
}
