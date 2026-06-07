// frontend/src/lib/api/dataRooms.ts
//
// Investor Data Rooms domain — ai-router /api/v1/investor/data-rooms.
// Falls back to mock-derived metadata so the screens render offline.

import { apiGet, apiPost, withFallback } from "./client";
import { mockStartups } from "@/dashboard/investors/section/data/mockData";

export const SECTION_LABELS = [
  "Metrics Dashboard", "Financials", "Testing Reports",
  "Compliance", "Governance", "Execution History",
];

export interface DataRoomMeta {
  projectId: string;
  sections: string[];
  docCount: number;
  complianceVerified: boolean;
  aiGovernanceVerified: boolean;
  updatedLabel: string;
}

export interface DataRoomsResponse {
  rooms: DataRoomMeta[];
  sections: string[];
  totals: {
    activeRooms: number;
    totalDocs: number;
    complianceVerified: number;
    aiSummaries: number;
  };
}

function fallback(): DataRoomsResponse {
  const rooms: DataRoomMeta[] = mockStartups.map((s) => ({
    projectId: s.id,
    sections: SECTION_LABELS,
    docCount: SECTION_LABELS.length,
    complianceVerified: !!s.complianceVerified,
    aiGovernanceVerified: !!s.aiGovernanceVerified,
    updatedLabel: "today",
  }));
  return {
    rooms,
    sections: SECTION_LABELS,
    totals: {
      activeRooms: rooms.length,
      totalDocs: rooms.length * SECTION_LABELS.length,
      complianceVerified: rooms.filter((r) => r.complianceVerified).length,
      aiSummaries: rooms.length,
    },
  };
}

/** GET /api/v1/investor/data-rooms — per-startup vault metadata + totals. */
export function fetchDataRooms(): Promise<DataRoomsResponse> {
  return withFallback(
    () => apiGet<DataRoomsResponse>("/investor/data-rooms"),
    fallback,
    "data rooms",
  );
}

/** POST /api/v1/investor/data-rooms/{projectId}/access — share with an investor. */
export function grantDataRoomAccess(
  projectId: string,
  investorId: string,
  canDownload = false,
): Promise<{ ok: boolean }> {
  return withFallback(
    () => apiPost<{ ok: boolean }>(`/investor/data-rooms/${projectId}/access`, { investorId, canDownload }),
    { ok: true },
    "grant data room access",
  );
}
