// frontend/src/lib/api/dealRooms.ts
//
// Investor Deal Rooms domain — ai-router /api/v1/investor/deal-rooms[/{projectId}].
// Falls back to bundled metadata so the screens render offline.

import { apiGet, apiPost, withFallback } from "./client";

export type DealStatus = "active" | "pending" | "closed";

export interface DealMeta {
  status: DealStatus;
  stage: string;
  daysOpen: number;
  messages: number;
  docs: number;
  lastActivity: string;
}

export const fallbackStageOrder = [
  "Intro Call", "NDA Signed", "Due Diligence", "Term Sheet", "Negotiation", "Deal Closed",
];

export const fallbackDealMeta: Record<string, DealMeta> = {
  "1": { status: "active",  stage: "Term Sheet",    daysOpen: 12, messages: 34,  docs: 7,  lastActivity: "2h ago" },
  "2": { status: "active",  stage: "Due Diligence", daysOpen: 8,  messages: 52,  docs: 11, lastActivity: "45m ago" },
  "3": { status: "pending", stage: "NDA Signed",    daysOpen: 3,  messages: 9,   docs: 2,  lastActivity: "1d ago" },
  "4": { status: "active",  stage: "Negotiation",   daysOpen: 21, messages: 78,  docs: 14, lastActivity: "3h ago" },
  "5": { status: "closed",  stage: "Deal Closed",   daysOpen: 45, messages: 120, docs: 22, lastActivity: "5d ago" },
  "6": { status: "pending", stage: "Intro Call",    daysOpen: 1,  messages: 4,   docs: 1,  lastActivity: "6h ago" },
};

export interface DealRoomsResponse {
  dealMeta: Record<string, DealMeta>;
  stageOrder: string[];
}

/** GET /api/v1/investor/deal-rooms */
export function fetchDealRooms(): Promise<DealRoomsResponse> {
  return withFallback(
    () => apiGet<DealRoomsResponse>("/investor/deal-rooms"),
    { dealMeta: fallbackDealMeta, stageOrder: fallbackStageOrder },
    "deal rooms",
  );
}

export interface DealRoomDetail {
  projectId: string;
  meta: DealMeta;
  valuationUSD: number;
  termSheet: {
    valuationUSD: number; investmentUSD: number; equityPercent: number;
    instrument: string; discountPercent: number; valuationCapUSD: number;
    extraTerms: Record<string, string>;
  };
  milestones: { milestone: string; amount: number; condition: string; status: string }[];
  documents: { name: string; status: string }[];
  negotiation: { step: string; state: string }[];
  stageOrder: string[];
}

/** POST /api/v1/investor/deal-rooms/{projectId} — detail (term sheet, milestones, docs). */
export function fetchDealRoom(
  projectId: string,
  startup?: Record<string, unknown>,
): Promise<DealRoomDetail | null> {
  return withFallback(
    () => apiPost<DealRoomDetail>(`/investor/deal-rooms/${projectId}`, startup ?? {}),
    () => null,
    "deal room detail",
  );
}
