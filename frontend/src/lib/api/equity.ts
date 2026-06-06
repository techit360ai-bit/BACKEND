// frontend/src/lib/api/equity.ts
//
// Collaborator equity domain — talks to ai-router GET/POST /api/v1/collaborator/equity.
// Falls back to bundled mock data so the Equity dashboard renders offline.

import { apiGet, apiPost, withFallback } from "./client";
import {
  equityHoldings,
  equityTotals,
  vestingTimeline,
  type EquityHolding,
  type VestingTimelineSeries,
} from "@/dashboard/collaborators/section/data/mockData";

export interface EquityTotals {
  totalValueUSD: number;
  blendedEquityPercent: number;
  vestedThisQuarterUSD: number;
  nextVest: { startup: string; date: string; deltaPercent: number } | null;
}

export interface CollaboratorEquity {
  holdings: EquityHolding[];
  totals: EquityTotals;
  vestingTimeline: VestingTimelineSeries[];
}

const FALLBACK: CollaboratorEquity = {
  holdings: equityHoldings,
  totals: equityTotals as EquityTotals,
  vestingTimeline,
};

/** GET /api/v1/collaborator/equity — holdings + totals + vesting timeline. */
export function fetchCollaboratorEquity(): Promise<CollaboratorEquity> {
  return withFallback(
    () => apiGet<CollaboratorEquity>("/collaborator/equity"),
    FALLBACK,
    "collaborator equity",
  );
}

export interface DilutionRequest {
  projectId: string;
  newSharesPercent: number;
  consentGiven: boolean;
}
export interface DilutionResult {
  projectId: string;
  newSharesPercent: number;
  consentGiven: boolean;
  protectedApplied: boolean;
  equityBefore: number;
  equityAfter: number;
  shieldedEquity: number;
}

/** POST /api/v1/collaborator/equity/dilution — apply dilution honoring protection. */
export function applyDilution(body: DilutionRequest): Promise<DilutionResult> {
  return withFallback(
    () => apiPost<DilutionResult>("/collaborator/equity/dilution", body),
    () => ({
      ...body,
      protectedApplied: !body.consentGiven,
      equityBefore: 0,
      equityAfter: 0,
      shieldedEquity: 0,
    }),
    "apply dilution",
  );
}
