// frontend/src/lib/api/capitalPools.ts
//
// Investor Capital Pools domain — ai-router /api/v1/investor/capital-pools.
// Falls back to the bundled hardcoded pools so the screen renders offline.

import { apiGet, apiPost, withFallback } from "./client";
import type { CapitalPool } from "@/dashboard/investors/section/data/mockData";

// The CapitalPools screen previously hardcoded these inline; kept here as the
// offline fallback fixture.
export const fallbackPools: CapitalPool[] = [
  {
    id: "1", name: "TechIT Micro Fund Alpha", totalCapital: 500000,
    deployed: 380000, startups: 8, milestonesHit: 24, fundsReleased: 280000,
    roiSimulation: 3.2, rules: { minReadiness: 85, maxPerStartup: 20, milestoneTrigger: true },
  },
  {
    id: "2", name: "AI Governance Fund", totalCapital: 750000,
    deployed: 520000, startups: 10, milestonesHit: 31, fundsReleased: 420000,
    roiSimulation: 4.1, rules: { minReadiness: 80, maxPerStartup: 15, milestoneTrigger: true },
  },
];

/** GET /api/v1/investor/capital-pools */
export function fetchCapitalPools(): Promise<CapitalPool[]> {
  return withFallback(
    async () => (await apiGet<{ pools: CapitalPool[] }>("/investor/capital-pools")).pools,
    fallbackPools,
    "capital pools",
  );
}

/** POST /api/v1/investor/capital-pools */
export function createCapitalPool(body: Partial<CapitalPool>): Promise<{ ok: boolean; pool: CapitalPool }> {
  return withFallback(
    () => apiPost<{ ok: boolean; pool: CapitalPool }>("/investor/capital-pools", body),
    () => ({ ok: true, pool: { ...(fallbackPools[0]), ...(body as CapitalPool) } }),
    "create capital pool",
  );
}
