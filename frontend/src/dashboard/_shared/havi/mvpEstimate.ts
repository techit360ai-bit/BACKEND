// "Time to MVP" estimation for Havi.
// Starts from a stage-based estimate, then lets each user override their target
// date. Persisted per-role in localStorage so the choice survives reloads.

import type { HaviRole } from "./haviData";

const MS_PER_DAY = 86_400_000;

// Stage → default days remaining until MVP (founder stages from UserContext).
// Collaborators don't have a stage, so they get a sensible build-cycle default.
const STAGE_DAYS: Record<string, number> = {
  Idea: 75,
  Validation: 55,
  MVP: 21, // actively shipping the MVP
  Beta: 0, // MVP already shipped
  Launch: 0,
  Growth: 0,
};

const COLLABORATOR_DEFAULT_DAYS = 45;
const FOUNDER_FALLBACK_DAYS = 60;

export interface MvpPlan {
  /** ISO date string (yyyy-mm-dd) the user is targeting for MVP. */
  targetDate: string;
  /** Total days in the journey when the plan was created (for progress math). */
  totalDays: number;
  /** Whether the user has explicitly set/edited this (vs. derived default). */
  userSet: boolean;
}

function storageKey(role: HaviRole) {
  return `techit:havi:mvp:${role}`;
}

function addDays(base: number, days: number): Date {
  return new Date(base + days * MS_PER_DAY);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Derive a default plan from the user's stage (no persistence). */
export function deriveDefaultPlan(role: HaviRole, stage?: string, now = Date.now()): MvpPlan {
  const days =
    role === "collaborator"
      ? COLLABORATOR_DEFAULT_DAYS
      : stage && stage in STAGE_DAYS
      ? STAGE_DAYS[stage]
      : FOUNDER_FALLBACK_DAYS;
  // Already-shipped stages: keep a short victory-lap window so the widget still renders.
  const effectiveDays = days <= 0 ? 7 : days;
  return {
    targetDate: toISODate(addDays(now, effectiveDays)),
    totalDays: effectiveDays,
    userSet: false,
  };
}

/** Load the persisted plan, or derive + persist a default. */
export function loadPlan(role: HaviRole, stage?: string, now = Date.now()): MvpPlan {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey(role)) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as MvpPlan;
      if (parsed && typeof parsed.targetDate === "string") return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const def = deriveDefaultPlan(role, stage, now);
  savePlan(role, def);
  return def;
}

export function savePlan(role: HaviRole, plan: MvpPlan): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey(role), JSON.stringify(plan));
    }
  } catch {
    /* storage may be unavailable (private mode) — fail silently */
  }
}

/** Update just the target date (marks the plan as user-set). */
export function setTargetDate(role: HaviRole, targetDate: string, now = Date.now()): MvpPlan {
  const target = new Date(targetDate + "T00:00:00").getTime();
  const totalDays = Math.max(1, Math.round((target - now) / MS_PER_DAY));
  const plan: MvpPlan = { targetDate, totalDays, userSet: true };
  savePlan(role, plan);
  return plan;
}

export interface MvpProgress {
  daysRemaining: number;
  totalDays: number;
  /** 0–100 elapsed-time progress toward the target. */
  percentElapsed: number;
  targetLabel: string; // human label e.g. "Aug 12"
  overdue: boolean;
}

export function computeProgress(plan: MvpPlan, now = Date.now()): MvpProgress {
  const target = new Date(plan.targetDate + "T00:00:00").getTime();
  const daysRemaining = Math.round((target - now) / MS_PER_DAY);
  const totalDays = Math.max(1, plan.totalDays);
  const elapsed = totalDays - daysRemaining;
  const percentElapsed = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
  const targetLabel = new Date(plan.targetDate + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return {
    daysRemaining,
    totalDays,
    percentElapsed,
    targetLabel,
    overdue: daysRemaining < 0,
  };
}
