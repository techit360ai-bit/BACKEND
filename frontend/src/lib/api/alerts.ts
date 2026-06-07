// frontend/src/lib/api/alerts.ts
//
// Anomaly scan + stagnation roster — ai-router /api/v1/admin/* .
// Surfaces engine alerts that no screen previously showed.

import { apiPost, withFallback } from "./client";

export interface RiskFlag {
  type?: string;
  message?: string;
  severity?: string;
  [k: string]: unknown;
}
export interface AnomalyScanResult {
  risk_flags: RiskFlag[];
  analysis?: string;
  scanned_at?: string;
}

/** POST /api/v1/admin/monitor/scan — anomaly scan over signals. */
export function runAnomalyScan(signals: Record<string, unknown>[]): Promise<AnomalyScanResult> {
  return withFallback(
    () => apiPost<AnomalyScanResult>("/admin/monitor/scan", { signals }),
    { risk_flags: [] },
    "anomaly scan",
  );
}

export interface StagnatingProject {
  project_id?: string;
  project_name?: string;
  days_inactive?: number;
  decay_factor?: number;
  score_penalty?: string;
  [k: string]: unknown;
}
export interface StagnationRoster {
  stagnating_count: number;
  total_projects: number;
  stagnating_list: StagnatingProject[];
  action?: string;
}

/** POST /api/v1/admin/stagnation-roster — decay-based stagnating-project roster. */
export function fetchStagnationRoster(projects: Record<string, unknown>[]): Promise<StagnationRoster> {
  return withFallback(
    () => apiPost<StagnationRoster>("/admin/stagnation-roster", { projects }),
    { stagnating_count: 0, total_projects: projects.length, stagnating_list: [] },
    "stagnation roster",
  );
}
