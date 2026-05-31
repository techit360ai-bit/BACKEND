// computeMomentum — pure derivation of a single 0-100 momentum score plus the
// team's next action. Recomputed each render (depends on now-time + check-in
// count). No React, no context. now is passed in so callers control time
// (Date.now() lives in the caller's useMemo, not here).

import type { HackathonRegistration } from "@/contexts/UserContext";

export interface MomentumResult {
  score: number;
  nextAction: "submit-brief" | "log-check-in" | "build" | "complete";
  nextActionLabel: string;
}

const HOUR = 1000 * 60 * 60;

function lastCheckInMs(reg: HackathonRegistration): number | null {
  const checkIns = reg.checkIns ?? [];
  if (checkIns.length === 0) return null;
  return checkIns.reduce((latest, c) => {
    const t = new Date(c.loggedAt).getTime();
    return t > latest ? t : latest;
  }, 0);
}

export function computeMomentum(reg: HackathonRegistration, now: number = Date.now()): MomentumResult {
  const checkIns = reg.checkIns ?? [];
  const hasBrief = !!reg.brief;

  // Score model
  let score = 0;
  if (hasBrief) score += 25;
  score += Math.min(checkIns.length, 10) * 5;          // +5 each, cap +50
  score += Math.min(reg.members.length, 5) * 5;         // +5 per filled member, cap +25

  const last = lastCheckInMs(reg);
  if (last !== null) {
    const idleHours = (now - last) / HOUR;
    const decay = Math.floor(idleHours / 6);            // -1 per 6h idle
    score -= Math.max(0, decay);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  // nextAction derivation
  if (reg.stage === "submitted-final") {
    return { score, nextAction: "complete", nextActionLabel: "Submitted ✓" };
  }
  if (!hasBrief) {
    return { score, nextAction: "submit-brief", nextActionLabel: "Submit brief to unlock Build" };
  }
  if (checkIns.length === 0) {
    return { score, nextAction: "log-check-in", nextActionLabel: "Kick off your first check-in" };
  }

  const hoursSince = last !== null ? (now - last) / HOUR : Infinity;
  if (hoursSince < 4) {
    const hoursLeft = Math.max(1, Math.ceil(4 - hoursSince));
    return { score, nextAction: "build", nextActionLabel: `On track — next check-in in ${hoursLeft}h` };
  }
  return { score, nextAction: "log-check-in", nextActionLabel: "Time for a check-in" };
}

// Shared color helper: emerald ≥70, amber 40-69, slate <40.
export function momentumColor(score: number): { text: string; bar: string } {
  if (score >= 70) return { text: "text-emerald-600", bar: "bg-emerald-500" };
  if (score >= 40) return { text: "text-amber-600", bar: "bg-amber-500" };
  return { text: "text-slate-500", bar: "bg-slate-400" };
}
