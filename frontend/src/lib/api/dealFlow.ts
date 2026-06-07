// frontend/src/lib/api/dealFlow.ts
//
// Investor deal-flow ranking + EVI-I — ai-router /api/v1/investor/deal-flow + /evi/{id}.
// Surfaces the real EVI-I / IIS / WCRS signals the Deal Intelligence screen
// previously only mocked. Falls back to null so callers keep their mock ranking.

import { apiGet, apiPost, withFallback } from "./client";

export interface DealFlowEntry {
  projectId?: string;
  name?: string;
  eviI?: number;          // EVI-I investor execution signal
  iis?: number;           // Investor Interest Score
  wcrs?: number;          // marketplace ranking score
  rank?: number;
  [k: string]: unknown;
}
export interface DealFlowResponse {
  ranking?: DealFlowEntry[];
  [k: string]: unknown;
}

/** GET /api/v1/investor/deal-flow — ranked deal flow with EVI-I signals. */
export function fetchDealFlow(): Promise<DealFlowResponse | null> {
  return withFallback(
    () => apiGet<DealFlowResponse>("/investor/deal-flow"),
    () => null,
    "deal flow ranking",
  );
}

export interface EviSignal {
  evi_i?: number;
  investment_score?: number;
  [k: string]: unknown;
}

/** POST /api/v1/investor/evi/{projectId} — 6-dimensional EVI-I signal for one startup. */
export function fetchEvi(projectId: string, startupData: Record<string, unknown>): Promise<EviSignal | null> {
  return withFallback(
    () => apiPost<EviSignal>(`/investor/evi/${projectId}`, startupData),
    () => null,
    "investor evi",
  );
}
