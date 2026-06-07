// frontend/src/lib/api/investorReputation.ts
//
// Investor Reputation domain — ai-router /api/v1/investor/reputation.
// Falls back to the previously-hardcoded values so the screen renders offline.

import { apiGet, withFallback } from "./client";

export interface RepMetric {
  key: string;
  label: string;
  score: number;
  description: string;
}
export interface RepReview {
  founderName: string;
  startup: string;
  rating: number;
  comment: string;
  date: string;
}
export interface RepProgression {
  month: string;
  score: number;
  change: number;
}
export interface InvestorReputation {
  score: number;
  level: string;
  monthChange: number;
  metrics: RepMetric[];
  reviews: RepReview[];
  progression: RepProgression[];
  leaderboard: { rank: number; total: number; percentile: number };
}

export const FALLBACK_REPUTATION: InvestorReputation = {
  score: 87,
  level: "Elite",
  monthChange: 3,
  metrics: [
    { key: "responseSpeed",       label: "Response Speed",             score: 92, description: "Average response time: 4.2 hours" },
    { key: "founderRating",       label: "Founder Rating",             score: 88, description: "Based on 12 founder reviews" },
    { key: "followThrough",       label: "Follow-Through Consistency", score: 85, description: "Commitments kept: 94%" },
    { key: "valueAdd",            label: "Value-Add Contributions",    score: 81, description: "Active portfolio support" },
    { key: "portfolioEngagement", label: "Portfolio Engagement",       score: 90, description: "Monthly check-ins: 100%" },
  ],
  reviews: [
    { founderName: "Sarah Chen",       startup: "QuantumAPI",   rating: 5, comment: "Incredibly responsive and provided valuable strategic guidance. Made the funding process smooth and transparent.", date: "Feb 8, 2026" },
    { founderName: "Marcus Rodriguez", startup: "NeuralEdge AI", rating: 5, comment: "Goes beyond capital. Opened doors to key partnerships and actively helps with hiring. True value-add investor.", date: "Feb 1, 2026" },
    { founderName: "Aisha Patel",      startup: "CloudMesh",    rating: 4, comment: "Professional and fair terms. Would have appreciated faster turnaround on due diligence.", date: "Jan 24, 2026" },
  ],
  progression: [
    { month: "Feb 2026", score: 87, change: 3 },
    { month: "Jan 2026", score: 84, change: 2 },
    { month: "Dec 2025", score: 82, change: 4 },
    { month: "Nov 2025", score: 78, change: 1 },
  ],
  leaderboard: { rank: 12, total: 284, percentile: 4.2 },
};

/** GET /api/v1/investor/reputation */
export function fetchInvestorReputation(): Promise<InvestorReputation> {
  return withFallback(
    () => apiGet<InvestorReputation>("/investor/reputation"),
    FALLBACK_REPUTATION,
    "investor reputation",
  );
}
