// Canned critique strings for the mock brief scorer.
// Keyed by sub-score rubric + signal name. scoring.ts pulls from here so it
// carries no copy of its own. No real LLM — deterministic heuristics only.

export type Rubric = "problemClarity" | "innovationGap" | "initialImpact";

const CRITIQUES: Record<Rubric, Record<string, string>> = {
  problemClarity: {
    shortProblem:    "Problem statement is short — name the specific user pain in concrete terms.",
    noPainVerb:      "Problem reads neutral — describe what users struggle with, can't do, or waste.",
    noSpecificity:   "Problem is generic — anchor it with a number, place, or named example.",
    vagueTargetUser: "Target user is fuzzy — say who exactly feels this, not just 'people'.",
    strong:          "Problem and audience are clearly drawn — a reader knows who hurts and why.",
  },
  innovationGap: {
    shortDifferentiator: "Differentiator is thin — explain what makes this unlike what already exists.",
    noComparison:        "Differentiator doesn't compare to alternatives — what is this better than, and how?",
    weakUrgency:         "Why-now is unconvincing — what shifted recently that makes this the moment?",
    notSpecificEdge:     "The edge is stated but not specific — give the mechanism, not just the claim.",
    strong:              "Clear wedge against alternatives with a credible reason it's timely.",
  },
  initialImpact: {
    noActionVerb:    "Solution sketch is abstract — describe what you'll actually build or automate.",
    thinSolution:    "Solution sketch is short — outline the core flow a user would experience.",
    unmeasurable:    "Success metric is vague — add a measurable target, percentage, or timeframe.",
    shortMetric:     "Success metric needs detail — what number, by when, for whom?",
    noRisk:          "Risk is unaddressed — name the thing most likely to sink this and your hedge.",
    strong:          "Concrete build plan with a measurable target and an honest risk called out.",
  },
};

export function critique(rubric: Rubric, signal: string): string {
  return CRITIQUES[rubric][signal] ?? "";
}
