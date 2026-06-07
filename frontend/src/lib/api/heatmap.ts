// frontend/src/lib/api/heatmap.ts
//
// Investor Global Heatmap geo signal — ai-router /api/v1/investor/heatmap.
// Provides the per-region readiness the engine previously lacked. Falls back to
// the prior hardcoded values offline.

import { apiGet, withFallback } from "./client";

export interface RegionSignal {
  name: string;
  avgReadiness: number;
  complianceRate: number;
  color: string;
}
export interface SectorSignal {
  sector: string;
  avgGrowth: number;
}
export interface HeatmapSignal {
  regions: RegionSignal[];
  sectors: SectorSignal[];
}

export const FALLBACK_HEATMAP: HeatmapSignal = {
  regions: [
    { name: "North America", avgReadiness: 84, complianceRate: 78, color: "text-emerald-400" },
    { name: "Europe",        avgReadiness: 86, complianceRate: 82, color: "text-blue-400" },
    { name: "Asia",          avgReadiness: 78, complianceRate: 64, color: "text-purple-400" },
  ],
  sectors: [],
};

/** GET /api/v1/investor/heatmap — per-region readiness/compliance + sector growth. */
export function fetchHeatmap(): Promise<HeatmapSignal> {
  return withFallback(() => apiGet<HeatmapSignal>("/investor/heatmap"), FALLBACK_HEATMAP, "heatmap");
}
