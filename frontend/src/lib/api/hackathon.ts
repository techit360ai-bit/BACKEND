// frontend/src/lib/api/hackathon.ts
//
// Hackathon intelligence — ai-router /api/v1/hackathons/*.
// Org-host real-time reporting (overview, velocity heatmap, leaderboard,
// pipeline) + team/founder (brief scoring, check-ins, status, workspace pipe).
// Falls back to mock so screens render offline.

import { apiGet, apiPost, withFallback } from "./client";

// ── Org host ────────────────────────────────────────────────────────────
export interface HackathonOverview {
  hackathonId: string;
  status: string;
  registrants: number;
  teamsFormed: number;
  stillSolo: number;
  ideaSubmissions: number;
  totalTeams: number;
  avgBuildVelocity: number;
}
export interface VelocityCell { teamId: string; name: string; activity: number }
export interface LeaderboardEntry { teamId: string; name: string; composite: number; crsBand: string }
export interface PipelineBuckets { incubationInvites: number; prototypeTrack: number; backToLearning: number }

export function fetchHackathonOverview(id: string): Promise<HackathonOverview | null> {
  return withFallback(() => apiGet<HackathonOverview>(`/hackathons/${id}/overview`), () => null, "hackathon overview");
}
export function fetchHackathonVelocity(id: string): Promise<VelocityCell[]> {
  return withFallback(
    async () => (await apiGet<{ teams: VelocityCell[] }>(`/hackathons/${id}/velocity`)).teams,
    [], "hackathon velocity",
  );
}
export function fetchHackathonLeaderboard(id: string): Promise<LeaderboardEntry[]> {
  return withFallback(
    async () => (await apiGet<{ leaderboard: LeaderboardEntry[] }>(`/hackathons/${id}/leaderboard`)).leaderboard,
    [], "hackathon leaderboard",
  );
}
export function fetchHackathonPipeline(id: string): Promise<PipelineBuckets | null> {
  return withFallback(
    async () => (await apiGet<{ buckets: PipelineBuckets }>(`/hackathons/${id}/pipeline`)).buckets,
    () => null, "hackathon pipeline",
  );
}

// ── Team / founder ──────────────────────────────────────────────────────
export interface BriefScore {
  problemClarityScore: number;
  teamMomentumScore: number;
  demoReadinessHours: number;
  platformAvg: number;
  judgePct: number;
  composite: number;
  crsBand: string;
}
export interface BriefResult { ok: boolean; score?: BriefScore; critiques?: string[] }

export function submitHackathonBrief(
  id: string, body: Record<string, unknown>,
): Promise<BriefResult | null> {
  return withFallback(() => apiPost<BriefResult>(`/hackathons/${id}/brief`, body), () => null, "submit brief");
}

export function logHackathonCheckIn(
  id: string, body: Record<string, unknown>,
): Promise<{ ok: boolean; checkIn?: { activityScore: number } } | null> {
  return withFallback(
    () => apiPost<{ ok: boolean; checkIn?: { activityScore: number } }>(`/hackathons/${id}/checkin`, body),
    () => ({ ok: true }), "hackathon checkin",
  );
}

export function provisionTeamWorkspace(
  id: string, teamId: string, projectId?: string,
): Promise<{ ok: boolean; workspace?: { id: string; projectId: string } } | null> {
  return withFallback(
    () => apiPost<{ ok: boolean; workspace?: { id: string; projectId: string } }>(
      `/hackathons/${id}/teams/${teamId}/workspace`, { projectId }),
    () => ({ ok: true }), "provision team workspace",
  );
}
