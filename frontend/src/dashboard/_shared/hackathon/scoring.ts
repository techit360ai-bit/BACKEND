// scoreBrief — pure, deterministic, content-derived mock scorer for idea briefs.
// Three independent rubrics run over the 7 fields; each returns a 0-100 sub-score
// plus critique strings drawn from critiques.ts. No real LLM (PR-E+). No randomness.

import type { IdeaBrief, BriefScore } from "@/contexts/UserContext";
import { critique } from "./critiques";

const PAIN_VERBS = ["struggle", "can't", "cant", "wastes", "waste", "lacks", "lack", "hard", "fail", "frustrat"];
const COMPARISON_WORDS = ["unlike", "vs", "versus", "instead of", "better than", "rather than", "compared to"];
const URGENCY_WORDS = ["now", "shift", "until recently", "new", "changed", "recent", "today", "finally"];
const ACTION_VERBS = ["build", "connect", "automate", "match", "generate", "track", "analyze", "streamline", "integrate", "sync"];

const lc = (s: string) => s.toLowerCase();
const hasAny = (s: string, words: string[]) => words.some((w) => lc(s).includes(w));
const hasNumber = (s: string) => /\d/.test(s);
const hasProperNoun = (s: string) => /\b[A-Z][a-z]{2,}/.test(s.trim().replace(/^./, " ")); // capitalized word not at sentence start

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreProblemClarity(b: IdeaBrief): { score: number; critiques: string[] } {
  let score = 0;
  const critiques: string[] = [];
  const len = b.problem.trim().length;

  if (len >= 80) score += 40;
  else if (len >= 40) score += 20;
  else critiques.push(critique("problemClarity", "shortProblem"));

  const namedUser = b.targetUser.trim().length >= 30;
  if (namedUser) score += 15;
  else critiques.push(critique("problemClarity", "vagueTargetUser"));

  if (hasAny(b.problem, PAIN_VERBS)) score += 15;
  else critiques.push(critique("problemClarity", "noPainVerb"));

  if (hasNumber(b.problem) || hasProperNoun(b.problem)) score += 15;
  else critiques.push(critique("problemClarity", "noSpecificity"));

  if (b.targetUser.trim().length >= 30) score += 15;

  if (critiques.length === 0) critiques.push(critique("problemClarity", "strong"));
  return { score: clamp100(score), critiques: critiques.slice(0, 3) };
}

function scoreInnovationGap(b: IdeaBrief): { score: number; critiques: string[] } {
  let score = 0;
  const critiques: string[] = [];
  const len = b.differentiator.trim().length;

  if (len >= 80) score += 35;
  else if (len >= 40) score += 20;
  else critiques.push(critique("innovationGap", "shortDifferentiator"));

  if (hasAny(b.differentiator, COMPARISON_WORDS)) score += 20;
  else critiques.push(critique("innovationGap", "noComparison"));

  if (hasAny(b.whyNow, URGENCY_WORDS)) score += 20;
  else critiques.push(critique("innovationGap", "weakUrgency"));

  if (len >= 60) score += 15;
  else if (len >= 40) critiques.push(critique("innovationGap", "notSpecificEdge"));

  if (critiques.length === 0) critiques.push(critique("innovationGap", "strong"));
  return { score: clamp100(score), critiques: critiques.slice(0, 3) };
}

function scoreInitialImpact(b: IdeaBrief): { score: number; critiques: string[] } {
  let score = 0;
  const critiques: string[] = [];

  if (hasAny(b.solutionSketch, ACTION_VERBS)) score += 15;
  else critiques.push(critique("initialImpact", "noActionVerb"));

  if (b.solutionSketch.trim().length >= 60) score += 15;
  else critiques.push(critique("initialImpact", "thinSolution"));

  if (hasNumber(b.successMetric) || /%|percent|week|day|month|hour/i.test(b.successMetric)) score += 20;
  else critiques.push(critique("initialImpact", "unmeasurable"));

  if (b.successMetric.trim().length >= 40) score += 15;
  else critiques.push(critique("initialImpact", "shortMetric"));

  if (b.risk.trim().length >= 30) score += 20;
  else critiques.push(critique("initialImpact", "noRisk"));

  if (critiques.length === 0) critiques.push(critique("initialImpact", "strong"));
  return { score: clamp100(score), critiques: critiques.slice(0, 3) };
}

export function scoreBrief(brief: IdeaBrief): BriefScore {
  const pc = scoreProblemClarity(brief);
  const ig = scoreInnovationGap(brief);
  const ii = scoreInitialImpact(brief);

  const overall = clamp100(0.4 * pc.score + 0.3 * ig.score + 0.3 * ii.score);

  return {
    problemClarity: pc.score,
    innovationGap:  ig.score,
    initialImpact:  ii.score,
    overall,
    critiques: {
      problemClarity: pc.critiques,
      innovationGap:  ig.critiques,
      initialImpact:  ii.critiques,
    },
    computedAt: brief.submittedAt || new Date().toISOString(),
  };
}
