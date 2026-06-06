// frontend/src/lib/api/earnings.ts
//
// Collaborator earnings/payouts domain — ai-router /api/v1/collaborator/earnings.
// Falls back to bundled mock data so the Earnings dashboard renders offline.

import { apiGet, apiPost, withFallback } from "./client";
import {
  cashEarnings,
  cashTotals,
  payouts,
  type CashEarning,
  type Payout,
} from "@/dashboard/collaborators/section/data/mockData";

export interface CashTotals {
  lifetimeUSD: number;
  pendingUSD: number;
  revenueShareTTMUsd: number;
}

export interface CollaboratorEarnings {
  cashEarnings: CashEarning[];
  payouts: Payout[];
  totals: CashTotals;
}

const FALLBACK: CollaboratorEarnings = {
  cashEarnings,
  payouts,
  totals: cashTotals as CashTotals,
};

/** GET /api/v1/collaborator/earnings — per-project earnings + payout ledger + totals. */
export function fetchCollaboratorEarnings(): Promise<CollaboratorEarnings> {
  return withFallback(
    () => apiGet<CollaboratorEarnings>("/collaborator/earnings"),
    FALLBACK,
    "collaborator earnings",
  );
}

export interface WithdrawRequest {
  amount: number;
  destination?: string;
  monthIso?: string;
  idemKey?: string;
}
export interface WithdrawResult {
  ok: boolean;
  error?: string;
  available?: number;
  payout?: Payout;
  destination?: string;
  newPendingUSD?: number;
}

/** POST /api/v1/collaborator/earnings/withdraw — request a withdrawal of pending funds. */
export function requestWithdrawal(body: WithdrawRequest): Promise<WithdrawResult> {
  return withFallback(
    () => apiPost<WithdrawResult>("/collaborator/earnings/withdraw", body),
    // Offline fallback: optimistic local success so the existing UX still works.
    () => ({
      ok: true,
      payout: {
        id: body.idemKey ?? `p-local`,
        monthIso: body.monthIso ?? new Date().toISOString().slice(0, 7),
        amount: body.amount,
        status: "processing" as const,
      },
      destination: body.destination ?? "•••1234",
    }),
    "request withdrawal",
  );
}
