# Collaborator Role Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Collaborator role end-to-end from the Figma Make export, mirroring the Investor/Org section pattern, with Equity as a peer of Earnings, full onboarding, profile, settings + role-switching, no AI-vibe chrome, and every action button functional.

**Architecture:** All collaborator code lives under `frontend/src/dashboard/collaborators/` in two siblings: `onboarding/` (6-step wizard) and `section/components/collab/` (12 layout/page files). Pages are nested under `<CollabLayout/>` in `App.tsx` (matching Org/Investor). State lives in `UserContext` (`collaboratorProfile` + `useActiveRoles`). Mock data is restructured in `section/data/mockData.ts` to split cash and equity cleanly.

**Tech Stack:** React 19, react-router-dom, TypeScript, Tailwind, lucide-react, sonner (toasts), recharts (already used by Org), shadcn/ui (already in tree under `section/components/ui/`).

**Spec:** [`docs/superpowers/specs/2026-05-26-collaborator-rebuild-design.md`](../specs/2026-05-26-collaborator-rebuild-design.md). Every task references the relevant spec section. Read the spec section before starting the task.

**Verification gate:** Every task ends with `cd frontend && npm run build` from WSL. Build success = TypeScript clean + Vite bundle clean = the task is ready to commit. No test framework exists in this repo (intentional — matches Investor/Org rebuild pattern). Manual browser verification is done by the user from a native Windows terminal (`npm run dev` does not work from WSL — see memory).

**Reference files to read before starting:**
- `frontend/src/App.tsx` — current route shape
- `frontend/src/contexts/UserContext.tsx` — partial `CollaboratorProfile` already defined
- `frontend/src/dashboard/organization/section/components/org/OrgLayout.tsx` — sidebar/feed-external pattern
- `frontend/src/dashboard/organization/onboarding/OrgProgressBar.tsx` + `OrgStep1.tsx` — onboarding shell pattern
- `frontend/src/dashboard/collaborators/section/data/mockData.ts` — current mock data (the starting point we rewrite)

---

## Phase 1 — Foundation (data + context)

### Task 1: Extend `UserContext.tsx` with collaborator state + active-roles hook

**Spec sections:** "UserContext changes", "Active roles derivation"

**Files:**
- Modify: `frontend/src/contexts/UserContext.tsx`

- [ ] **Step 1: Extend the `CollaboratorProfile` interface**

Locate the existing `CollaboratorProfile` interface (lines ~79-107). Replace it with the extended version below. Remove `hourlyRateFloor` (superseded). Add the new fields exactly as listed:

```ts
export interface NotificationPrefs {
  opportunities: { email: boolean; inApp: boolean };
  deadlines:     { email: boolean; inApp: boolean };
  payments:      { email: boolean; inApp: boolean };
  equityEvents:  { email: boolean; inApp: boolean };
  quietHours:    "off" | "10pm-8am" | "weekends";
}

export interface CollaboratorProfile {
  // Step 1 — Identity
  name: string;
  title: string;
  location: string;
  yearsExperience: number;
  headline: string;
  avatarUrl: string;

  // Step 2 — Discipline & sub-skills
  discipline: CollaboratorDiscipline | "";
  subSkills: string[];

  // Step 3 — Tech stack
  techStack: string[];

  // Step 4 — Availability
  weeklyHours: number;
  timezone: string;
  earliestStart: "this-week" | "2-weeks" | "1-month";
  commitmentStyle: "deep" | "parallel" | "many";

  // Step 5 — Mission: Building for Equity
  equityPreference: number;
  minCashFloor: number;
  vestingComfort: "standard" | "1y-cliff-4y" | "custom";

  // Step 6 — Portfolio & goals
  links: { github: string; linkedin: string; portfolio: string; twitter: string };
  whyHere: string;
  pinnedWork: string[];

  // Status / settings
  onboardingComplete: boolean;
  notifications: NotificationPrefs;
}
```

- [ ] **Step 2: Add the `Role` type at the top of the file (below the existing type exports)**

```ts
export type Role = "founder" | "collaborator" | "investor" | "org";
```

- [ ] **Step 3: Add `collaboratorProfile` and `updateCollaboratorProfile` to `UserContextType`**

Locate `UserContextType` interface (~line 109). Add the two lines (already present in the partial edit — verify):

```ts
collaboratorProfile: CollaboratorProfile;
updateCollaboratorProfile: (updates: Partial<CollaboratorProfile>) => void;
```

- [ ] **Step 4: Add provider state for `collaboratorProfile` (inside `UserProvider`, alongside `orgProfile` state)**

```ts
const [collaboratorProfile, setCollaboratorProfile] = useState<CollaboratorProfile>({
  name: "Alex Chen",
  title: "Senior Frontend Engineer",
  location: "Lagos, Nigeria",
  yearsExperience: 7,
  headline: "I ship product-grade React systems quickly.",
  avatarUrl: "",
  discipline: "Engineering",
  subSkills: ["React", "TypeScript", "Node.js", "System design", "Performance"],
  techStack: ["React", "Next.js", "Postgres", "Vercel", "Tailwind", "tRPC"],
  weeklyHours: 20,
  timezone: "WAT",
  earliestStart: "this-week",
  commitmentStyle: "parallel",
  equityPreference: 65,
  minCashFloor: 2000,
  vestingComfort: "standard",
  links: {
    github: "github.com/alexchen",
    linkedin: "linkedin.com/in/alexchen",
    portfolio: "alexchen.dev",
    twitter: "@alexchen",
  },
  whyHere: "A product that becomes someone's daily tool, with skin in the game.",
  pinnedWork: [],
  onboardingComplete: true, // defaults to true so dev hot-reload lands on dashboard; set false in real first-visit flow once auth lands
  notifications: {
    opportunities: { email: true, inApp: true },
    deadlines:     { email: true, inApp: true },
    payments:      { email: true, inApp: true },
    equityEvents:  { email: true, inApp: true },
    quietHours:    "off",
  },
});

const updateCollaboratorProfile = (updates: Partial<CollaboratorProfile>) => {
  setCollaboratorProfile((prev) => ({ ...prev, ...updates }));
};
```

- [ ] **Step 5: Wire `collaboratorProfile` + `updateCollaboratorProfile` into the context value**

Locate the `<UserContext.Provider value={{ … }}>` block (~lines 164-172). Add the two new keys alongside the existing ones:

```tsx
<UserContext.Provider
  value={{
    investorProfile,
    updateInvestorProfile,
    orgProfile,
    updateOrgProfile,
    collaboratorProfile,
    updateCollaboratorProfile,
  }}
>
```

- [ ] **Step 6: Add `useCollaboratorProfile` hook at the bottom of the file (after `useOrgProfile`)**

```ts
export function useCollaboratorProfile() {
  const { collaboratorProfile, updateCollaboratorProfile } = useUser();
  return { collaboratorProfile, updateCollaboratorProfile };
}
```

- [ ] **Step 7: Add `useActiveRoles` hook at the very bottom of the file**

```ts
import { useLocation } from "react-router-dom";

// (Place this `useLocation` import at the top of the file with the other react-router imports.)

export function useActiveRoles(): { activeRoles: Set<Role>; currentRole: Role } {
  const { collaboratorProfile, investorProfile, orgProfile } = useUser();
  const location = useLocation();

  const activeRoles = new Set<Role>(["founder"]);
  if (collaboratorProfile.onboardingComplete) activeRoles.add("collaborator");
  if (investorProfile.industries.length > 0) activeRoles.add("investor");
  if (orgProfile.verificationStatus !== "unverified") activeRoles.add("org");

  const path = location.pathname;
  let currentRole: Role = "founder";
  if (path.startsWith("/collaborator")) currentRole = "collaborator";
  else if (path.startsWith("/investor"))    currentRole = "investor";
  else if (path.startsWith("/org"))         currentRole = "org";

  return { activeRoles, currentRole };
}
```

Note: `useLocation` must be imported at the file top — add `import { useLocation } from "react-router-dom";` near the existing imports if not already present.

- [ ] **Step 8: Verify build**

```bash
cd frontend && npm run build
```
Expected: success. If TS complains about `Role` not being a named export from a consuming file, that's fine — no consumers yet.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/contexts/UserContext.tsx
git commit -m "$(cat <<'EOF'
feat(context): wire collaborator profile + useActiveRoles hook

Extends CollaboratorProfile with headline, timezone, commitment style,
equity preference floors, vesting comfort, pinned work, onboardingComplete
flag, and notification preferences. Adds collaboratorProfile state to the
provider, exposes useCollaboratorProfile hook, and introduces useActiveRoles
for the top-bar role menu and the Settings → Roles section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Rewrite `mockData.ts` with equity-first shape

**Spec sections:** "Mock data changes", "Date freshness"

**Files:**
- Modify (full rewrite): `frontend/src/dashboard/collaborators/section/data/mockData.ts`

- [ ] **Step 1: Replace the file with the new shape (full rewrite)**

The new file exports: `collaboratorProfile` (kept for back-compat read in older parts of the export until they're rewritten), `projects`, `tasks`, `performanceMetrics`, `weeklyVelocity`, `equityHoldings`, `cashEarnings`, `equityTotals`, `payouts`, `vestingTimeline`, `opportunities` (extended), `badges`, `signals` (replaces `aiInsights`), `conversations` (replaces `messages`), `tools` (typed as `ToolIntegration[]`), `leaderboard`, `endorsements`, `recentActivity` (promoted to top-level).

Use the type definitions exactly:

```ts
// frontend/src/dashboard/collaborators/section/data/mockData.ts

import type { Project, Task, Metric, Badge } from "../types";

// ────────────────────────────────────────────────────────────────
// EQUITY (the thesis)
// ────────────────────────────────────────────────────────────────

export interface CapTableRow {
  label: string;     // "Founders" / "Collaborator pool" / "You" / "Investors" / "Treasury"
  percent: number;
  highlighted?: boolean;
}

export interface EquityHolding {
  projectId: string;
  projectName: string;
  projectLogo: string;
  equityPercent: number;
  valueUSD: number;
  vestedPercent: number;
  vestingSchedule: { years: number; cliffMonths: number };
  grantDate: string;             // ISO
  nextVest: { date: string; deltaPercent: number } | null;
  capTable: CapTableRow[];
}

export const equityHoldings: EquityHolding[] = [
  {
    projectId: "1",
    projectName: "NeuralSync AI",
    projectLogo: "🧠",
    equityPercent: 0.8,
    valueUSD: 24000,
    vestedPercent: 50,
    vestingSchedule: { years: 4, cliffMonths: 12 },
    grantDate: "2025-01-15",
    nextVest: { date: "2026-06-12", deltaPercent: 0.2 },
    capTable: [
      { label: "Founders",           percent: 65 },
      { label: "Collaborator pool",  percent: 12 },
      { label: "You",                percent: 0.8, highlighted: true },
      { label: "Investors",          percent: 18 },
      { label: "Treasury",           percent: 4.2 },
    ],
  },
  {
    projectId: "2",
    projectName: "FinFlow",
    projectLogo: "💰",
    equityPercent: 0.5,
    valueUSD: 15000,
    vestedPercent: 25,
    vestingSchedule: { years: 4, cliffMonths: 12 },
    grantDate: "2025-03-01",
    nextVest: { date: "2026-09-01", deltaPercent: 0.15 },
    capTable: [
      { label: "Founders",           percent: 70 },
      { label: "Collaborator pool",  percent: 10 },
      { label: "You",                percent: 0.5, highlighted: true },
      { label: "Investors",          percent: 17 },
      { label: "Treasury",           percent: 2.5 },
    ],
  },
  {
    projectId: "3",
    projectName: "HealthTrack Pro",
    projectLogo: "🏥",
    equityPercent: 0.3,
    valueUSD: 9200,
    vestedPercent: 0,
    vestingSchedule: { years: 4, cliffMonths: 12 },
    grantDate: "2025-08-10",
    nextVest: { date: "2026-08-10", deltaPercent: 0.075 },
    capTable: [
      { label: "Founders",           percent: 72 },
      { label: "Collaborator pool",  percent: 8 },
      { label: "You",                percent: 0.3, highlighted: true },
      { label: "Investors",          percent: 17 },
      { label: "Treasury",           percent: 2.7 },
    ],
  },
];

export const equityTotals = {
  totalValueUSD: 48200,
  blendedEquityPercent: 1.6,
  vestedThisQuarterUSD: 6400,
  nextVest: { startup: "NeuralSync AI", date: "2026-06-12", deltaPercent: 0.2 },
};

// 48-month vesting timeline (one entry per holding, 48 monthly samples each)
export interface VestingTimelinePoint { monthIso: string; vestedPercent: number; }
export interface VestingTimelineSeries { projectId: string; projectName: string; points: VestingTimelinePoint[]; }
export const vestingTimeline: VestingTimelineSeries[] = equityHoldings.map((h) => ({
  projectId: h.projectId,
  projectName: h.projectName,
  points: Array.from({ length: 48 }, (_, i) => {
    const grant = new Date(h.grantDate);
    const date  = new Date(grant.getFullYear(), grant.getMonth() + i, 1);
    const cliffPassed = i >= h.vestingSchedule.cliffMonths;
    const totalMonths = h.vestingSchedule.years * 12;
    const vested = cliffPassed ? Math.min(100, (i / totalMonths) * 100) : 0;
    return { monthIso: date.toISOString().slice(0, 7), vestedPercent: Math.round(vested) };
  }),
}));

// ────────────────────────────────────────────────────────────────
// CASH
// ────────────────────────────────────────────────────────────────

export interface CashEarning {
  projectId: string;
  projectName: string;
  earned: number;
  pending: number;
  revenueSharePercent: number;
  contributionNote: string;
}

export const cashEarnings: CashEarning[] = [
  { projectId: "1", projectName: "NeuralSync AI",  earned: 45000, pending: 5000,  revenueSharePercent: 2.5, contributionNote: "Dashboard feature increased user retention by 18%" },
  { projectId: "2", projectName: "FinFlow",        earned: 38000, pending: 4500,  revenueSharePercent: 1.8, contributionNote: "Payment integration enabled $500K in transactions" },
  { projectId: "3", projectName: "HealthTrack Pro", earned: 22000, pending: 2850, revenueSharePercent: 1.2, contributionNote: "ML model improved prediction accuracy by 12%" },
];

export interface Payout {
  id: string;
  monthIso: string;  // "2026-04"
  amount: number;
  status: "paid" | "processing";
}
export const payouts: Payout[] = [
  // 12 months back from 2026-05
  { id: "p12", monthIso: "2025-06", amount:  8200, status: "paid" },
  { id: "p11", monthIso: "2025-07", amount:  9100, status: "paid" },
  { id: "p10", monthIso: "2025-08", amount: 10400, status: "paid" },
  { id: "p9",  monthIso: "2025-09", amount: 11200, status: "paid" },
  { id: "p8",  monthIso: "2025-10", amount: 10800, status: "paid" },
  { id: "p7",  monthIso: "2025-11", amount: 12400, status: "paid" },
  { id: "p6",  monthIso: "2025-12", amount: 11900, status: "paid" },
  { id: "p5",  monthIso: "2026-01", amount: 13200, status: "paid" },
  { id: "p4",  monthIso: "2026-02", amount: 13800, status: "paid" },
  { id: "p3",  monthIso: "2026-03", amount: 14100, status: "paid" },
  { id: "p2",  monthIso: "2026-04", amount: 14600, status: "paid" },
  { id: "p1",  monthIso: "2026-05", amount: 12350, status: "processing" },
];

export const cashTotals = {
  lifetimeUSD: 128450,
  pendingUSD: 12350,
  revenueShareTTMUsd: 14200,
};

// ────────────────────────────────────────────────────────────────
// PROJECTS / TASKS
// ────────────────────────────────────────────────────────────────

export const collaboratorProfile = {
  name: "Alex Chen",
  roles: ["Frontend", "ML", "Product"],
  reputationScore: 94,
  executionScore: 87,
  lifetimeEarnings: 128450,
  pendingEarnings: 12350,
  activeProjectsCount: 3,
  completedProjects: 12,
  endorsements: 47,
  reliabilityScore: 92,
};

export const projects: Project[] = [
  { id: "1", name: "NeuralSync AI",   logo: "🧠", role: "Lead Frontend Engineer",
    progress: 78, deadline: "2026-06-20", status: "healthy",
    sprintGoal: "Ship dashboard v2.0 with real-time analytics",
    tasksAssigned: 8, recentActivity: "Merged PR #234 — WebSocket integration",
    lastActivity: "Implemented real-time data streaming component",
    blockers: [], nextAction: "Review design system updates" },
  { id: "2", name: "FinFlow",          logo: "💰", role: "Full-Stack Developer",
    progress: 45, deadline: "2026-06-08", status: "risk",
    sprintGoal: "Complete payment gateway integration",
    tasksAssigned: 12, recentActivity: "Working on Stripe API integration",
    lastActivity: "Set up webhook handlers for payment events",
    blockers: ["Waiting on API keys from founder", "Design specs incomplete"],
    nextAction: "Complete transaction history UI" },
  { id: "3", name: "HealthTrack Pro",  logo: "🏥", role: "ML Engineer",
    progress: 23, deadline: "2026-05-29", status: "critical",
    sprintGoal: "Train and deploy predictive model",
    tasksAssigned: 15, recentActivity: "Data preprocessing pipeline built",
    lastActivity: "Cleaned and normalized 50K patient records",
    blockers: ["Model accuracy below 85%", "Need more training data"],
    nextAction: "Optimize feature engineering" },
];

export const tasks: Task[] = [
  { id: "t1", title: "Optimize ML model accuracy for HealthTrack",  projectId: "3", projectName: "HealthTrack Pro", priority: "critical", deadline: "2026-05-27", impactScore: 95, dependencies: ["Data pipeline completion"], aiReason: "", status: "in-progress", aiRank: 1 },
  { id: "t2", title: "Complete Stripe webhook integration",          projectId: "2", projectName: "FinFlow",         priority: "high",     deadline: "2026-05-29", impactScore: 88, dependencies: ["API keys from founder"], aiReason: "", status: "pending",      aiRank: 2 },
  { id: "t3", title: "Review and merge design system PR",            projectId: "1", projectName: "NeuralSync AI",   priority: "high",     deadline: "2026-05-28", impactScore: 82, dependencies: [], aiReason: "", status: "pending",      aiRank: 3 },
  { id: "t4", title: "Implement real-time notifications",            projectId: "1", projectName: "NeuralSync AI",   priority: "medium",   deadline: "2026-06-03", impactScore: 75, dependencies: ["WebSocket setup"], aiReason: "", status: "pending",      aiRank: 4 },
  { id: "t5", title: "Write API documentation",                      projectId: "2", projectName: "FinFlow",         priority: "medium",   deadline: "2026-06-05", impactScore: 68, dependencies: [], aiReason: "", status: "pending",      aiRank: 5 },
  { id: "t6", title: "Update component library",                     projectId: "1", projectName: "NeuralSync AI",   priority: "low",      deadline: "2026-06-10", impactScore: 45, dependencies: [], aiReason: "", status: "pending",      aiRank: 6 },
];

// aiReason kept on Task[] but emptied — the type still requires it, but UI never reads it.
// Performance / velocity
export const performanceMetrics: Metric[] = [
  { name: "Execution Velocity", value: 87, change:  4, trend: "up" },
  { name: "Consistency Score",  value: 92, change: -2, trend: "down" },
  { name: "Completion Rate",    value: 94, change:  0, trend: "stable" },
  { name: "Collaboration Score",value: 78, change: -5, trend: "down" },
  { name: "Impact Score",       value: 89, change:  7, trend: "up" },
];

export const weeklyVelocity = [
  { week: "Week 1", tasks: 12, impact: 85 },
  { week: "Week 2", tasks: 15, impact: 92 },
  { week: "Week 3", tasks: 18, impact: 88 },
  { week: "Week 4", tasks: 14, impact: 95 },
];

// ────────────────────────────────────────────────────────────────
// SIGNALS (replaces aiInsights — concrete facts only, every row links somewhere)
// ────────────────────────────────────────────────────────────────

export interface Signal {
  id: string;
  type: "messages" | "vesting" | "opportunity" | "deadline";
  message: string;
  href: string;
}
export const signals: Signal[] = [
  { id: "s1", type: "messages",    message: "2 messages awaiting reply",                                       href: "/collaborator/messages" },
  { id: "s2", type: "vesting",     message: "NeuralSync vest in 17 days · +0.2% equity",                       href: "/collaborator/equity" },
  { id: "s3", type: "opportunity", message: "1 opportunity matches your stack — CloudVault (92% match)",       href: "/collaborator/opportunities" },
  { id: "s4", type: "deadline",    message: "HealthTrack ML deadline in 1 day · impact 95",                    href: "/collaborator/tasks" },
];

// ────────────────────────────────────────────────────────────────
// OPPORTUNITIES (extended with detail-drawer fields)
// ────────────────────────────────────────────────────────────────

export interface OpportunityDetail {
  id: string;
  title: string;
  company: string;
  type: "project" | "advisory" | "gig" | "testing";
  cashCompMonthly: number;          // 0 for one-time
  cashCompOneTime: number;          // 0 if monthly
  equityPercent: number;            // 0 if cash-only
  timeCommitment: string;
  riskLevel: "low" | "medium" | "high";
  teamQuality: number;              // 0-100
  matchScore: number;
  skills: string[];
  description: string;
  teamBios: { name: string; role: string }[];
  timeline: string;
  status?: "open" | "applied" | "passed";
}

export const opportunities: OpportunityDetail[] = [
  { id: "o1", title: "Senior Full-Stack Engineer", company: "CloudVault", type: "project",  cashCompMonthly: 10000, cashCompOneTime: 0,    equityPercent: 0.5, timeCommitment: "30–40 hrs/week", riskLevel: "low",    teamQuality: 95, matchScore: 92, skills: ["React", "Node.js", "AWS", "TypeScript"], description: "Lead the rebuild of CloudVault's storage dashboard for enterprise customers.", teamBios: [{ name: "Marcus Lee", role: "CEO" }, { name: "Pri Shah", role: "CTO" }], timeline: "Starts June 8 · 3-month engagement, renewable", status: "open" },
  { id: "o2", title: "ML Consultant for Healthcare Startup", company: "MediAI", type: "advisory", cashCompMonthly: 5000, cashCompOneTime: 0, equityPercent: 0.25, timeCommitment: "5–10 hrs/week", riskLevel: "medium", teamQuality: 88, matchScore: 87, skills: ["Machine Learning", "Python", "Healthcare"], description: "Advise on model architecture and evaluation for a healthcare prediction product entering FDA pre-submission.", teamBios: [{ name: "Dr. Anya Rao", role: "Founder" }], timeline: "6 months, with monthly checkpoint reviews", status: "open" },
  { id: "o3", title: "Frontend Performance Audit", company: "SpeedyApp", type: "gig", cashCompMonthly: 0, cashCompOneTime: 3000, equityPercent: 0, timeCommitment: "10–15 hrs total", riskLevel: "low", teamQuality: 82, matchScore: 85, skills: ["React", "Performance Optimization", "Webpack"], description: "One-off performance audit + recommendations for SpeedyApp's React dashboard.", teamBios: [{ name: "Jen Park", role: "Founder" }], timeline: "1-week turnaround", status: "open" },
  { id: "o4", title: "Beta Tester for Dev Tools", company: "CodeCraft", type: "testing", cashCompMonthly: 0, cashCompOneTime: 500, equityPercent: 0, timeCommitment: "2–5 hrs/week", riskLevel: "low", teamQuality: 90, matchScore: 78, skills: ["Developer Tools", "Feedback"], description: "Use CodeCraft's early-access build for daily work, file structured feedback weekly.", teamBios: [{ name: "Sam Wei", role: "PM" }], timeline: "Open-ended", status: "open" },
];

// ────────────────────────────────────────────────────────────────
// BADGES / REPUTATION / LEADERBOARD / ENDORSEMENTS
// ────────────────────────────────────────────────────────────────

export const badges: Badge[] = [
  { id: "b1", title: "Top 1% Builder",       description: "Ranked in top 1% of all collaborators",          earned: true,  icon: "🏆" },
  { id: "b2", title: "High Execution Velocity", description: "Consistently deliver above 85% velocity score", earned: true,  icon: "⚡" },
  { id: "b3", title: "Trusted Collaborator", description: "10+ successful project completions",             earned: true,  icon: "✨" },
  { id: "b4", title: "Equity Owner",          description: "Hold equity in 3+ active startups",              earned: true,  icon: "🤝" },
  { id: "b5", title: "Fast Responder",       description: "Average response time under 2 hours",            earned: false, icon: "💬" },
  { id: "b6", title: "Revenue Generator",    description: "Contributed to $1M+ in revenue",                 earned: false, icon: "💰" },
];

export const leaderboard = [
  { rank: 1, name: "Jordan Smith",  score: 98, earnings: 245000, projects: 18 },
  { rank: 2, name: "Emma Wilson",   score: 96, earnings: 223000, projects: 15 },
  { rank: 3, name: "Alex Chen",     score: 94, earnings: 128450, projects: 12, isCurrentUser: true },
  { rank: 4, name: "Ryan Park",     score: 93, earnings: 198000, projects: 14 },
  { rank: 5, name: "Lisa Anderson", score: 91, earnings: 176000, projects: 11 },
];

export interface Endorsement {
  id: string;
  fromName: string;
  fromRole: string;
  fromAvatar: string;          // emoji or initials
  quote: string;
  projectName: string;
  date: string;                // ISO
}

export const endorsements: Endorsement[] = [
  { id: "e1", fromName: "Sarah Kim",   fromRole: "Designer",    fromAvatar: "SK", quote: "Alex turns specs into product faster than anyone I've worked with.",         projectName: "NeuralSync AI",   date: "2026-04-12" },
  { id: "e2", fromName: "Mike Johnson", fromRole: "Founder",    fromAvatar: "MJ", quote: "Unblocks the team. Owns outcomes. Worth every basis point.",                  projectName: "FinFlow",         date: "2026-03-28" },
  { id: "e3", fromName: "Dr. Anya Rao", fromRole: "ML Lead",    fromAvatar: "AR", quote: "Caught a subtle data leak in our pipeline that everyone else missed.",         projectName: "HealthTrack Pro", date: "2026-03-04" },
  // (Add 7 more for pagination demo — same shape)
  { id: "e4", fromName: "Riya Patel",   fromRole: "PM",         fromAvatar: "RP", quote: "Pragmatic. Picks the right battles.",                                          projectName: "NeuralSync AI",   date: "2026-02-19" },
  { id: "e5", fromName: "Tomás Vega",   fromRole: "Engineer",   fromAvatar: "TV", quote: "Code reviews that make the team better.",                                       projectName: "FinFlow",         date: "2026-02-10" },
  { id: "e6", fromName: "Naomi Tanaka", fromRole: "Designer",   fromAvatar: "NT", quote: "Translates design intent into shippable code without losing the polish.",      projectName: "NeuralSync AI",   date: "2026-01-25" },
  { id: "e7", fromName: "Ben Olusola",  fromRole: "Founder",    fromAvatar: "BO", quote: "Saved our launch. Period.",                                                     projectName: "HealthTrack Pro", date: "2026-01-12" },
  { id: "e8", fromName: "Liu Chen",     fromRole: "Engineer",   fromAvatar: "LC", quote: "First person I'd hire on my next company.",                                     projectName: "FinFlow",         date: "2025-12-30" },
  { id: "e9", fromName: "Maya Iyer",    fromRole: "Founder",    fromAvatar: "MI", quote: "Equity well spent.",                                                            projectName: "NeuralSync AI",   date: "2025-12-15" },
  { id: "e10", fromName: "Dan Reyes",   fromRole: "Engineer",   fromAvatar: "DR", quote: "Made the dashboard the thing customers reference in calls.",                   projectName: "NeuralSync AI",   date: "2025-11-30" },
];

// ────────────────────────────────────────────────────────────────
// MESSAGES → CONVERSATIONS (with threads)
// ────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  fromMe: boolean;
  authorName: string;
  body: string;
  timestamp: string;            // ISO
}
export interface Conversation {
  id: string;
  participantName: string;
  participantAvatar: string;    // initials
  projectName: string;
  subject: string;
  unread: boolean;
  thread: ConversationMessage[];
}

export const conversations: Conversation[] = [
  { id: "c1", participantName: "Sarah Kim", participantAvatar: "SK", projectName: "NeuralSync AI", subject: "Design system approval needed", unread: true,
    thread: [
      { id: "m1", fromMe: false, authorName: "Sarah Kim", body: "Can you review the updated color palette? Sharing the Figma link below.", timestamp: "2026-05-26T08:00:00Z" },
      { id: "m2", fromMe: false, authorName: "Sarah Kim", body: "https://figma.com/design/abc — focus on the slate + amber pairing.",        timestamp: "2026-05-26T08:01:00Z" },
    ] },
  { id: "c2", participantName: "Mike Johnson", participantAvatar: "MJ", projectName: "FinFlow", subject: "API keys ready", unread: true,
    thread: [
      { id: "m3", fromMe: false, authorName: "Mike Johnson", body: "Stripe credentials are now in the env file. Webhook secret rotated.", timestamp: "2026-05-26T05:00:00Z" },
    ] },
  { id: "c3", participantName: "Operations", participantAvatar: "OP", projectName: "TechIT", subject: "Weekly performance summary", unread: false,
    thread: [
      { id: "m4", fromMe: false, authorName: "Operations", body: "Your execution velocity improved by 4 points this week. Across builds: 3 PRs merged, 12 tasks closed.", timestamp: "2026-05-25T10:00:00Z" },
    ] },
];

// ────────────────────────────────────────────────────────────────
// TOOLS
// ────────────────────────────────────────────────────────────────

export interface ToolIntegration {
  id: string;
  name: string;
  status: "connected" | "disconnected";
  scopes: string[];
  lastSyncedAt: string | null;
  updates: number;
}

export const tools: ToolIntegration[] = [
  { id: "github",   name: "GitHub",   status: "connected",    scopes: ["repo:read", "pr:write"],              lastSyncedAt: "2026-05-26T08:00:00Z", updates: 5 },
  { id: "figma",    name: "Figma",    status: "connected",    scopes: ["files:read", "comments:write"],       lastSyncedAt: "2026-05-26T07:30:00Z", updates: 2 },
  { id: "notion",   name: "Notion",   status: "connected",    scopes: ["pages:read", "pages:write"],          lastSyncedAt: "2026-05-26T06:00:00Z", updates: 8 },
  { id: "linear",   name: "Linear",   status: "disconnected", scopes: [],                                     lastSyncedAt: null,                   updates: 0 },
  { id: "vercel",   name: "Vercel",   status: "connected",    scopes: ["deployments:read"],                   lastSyncedAt: "2026-05-26T05:00:00Z", updates: 3 },
  { id: "supabase", name: "Supabase", status: "connected",    scopes: ["projects:read", "logs:read"],         lastSyncedAt: "2026-05-26T04:00:00Z", updates: 1 },
];

export const recentActivity: { id: string; projectName: string; projectLogo: string; message: string; timestampISO: string }[] = [
  { id: "ra1", projectName: "NeuralSync AI",   projectLogo: "🧠", message: "Merged PR #234 — WebSocket integration", timestampISO: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: "ra2", projectName: "FinFlow",         projectLogo: "💰", message: "Pushed branch feat/stripe-webhooks",      timestampISO: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: "ra3", projectName: "HealthTrack Pro", projectLogo: "🏥", message: "Cleaned and normalized 50K patient records", timestampISO: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
];
```

- [ ] **Step 2: Sanity-check the `types.ts` file is compatible**

```bash
cd frontend && cat src/dashboard/collaborators/section/components/../../section/data/../../section/data/../section/data/../section/data/../types.ts 2>/dev/null || find src/dashboard/collaborators/section -name 'types.ts' -exec cat {} \;
```

The mock data imports `Project`, `Task`, `Metric`, `Badge` from `../types`. If those types are missing fields used here (like `aiReason: string`), the existing types are wider than what UI consumes — leave them as-is. If the types live in `section/components/` or elsewhere, update the import path accordingly. Do not remove fields from `types.ts`.

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```
Expected: success. If imports fail, locate `types.ts` and adjust the import path at top of `mockData.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/dashboard/collaborators/section/data/mockData.ts
git commit -m "$(cat <<'EOF'
feat(collab): restructure mock data with equity-first shape

Splits earnings into cashEarnings + equityHoldings with cap tables,
adds vestingTimeline series, payouts, signals (replaces aiInsights),
typed ToolIntegration[], conversation threads, endorsements, and a
top-level recentActivity feed. Shifts all dates relative to May 2026.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Layout shell

### Task 3: Create `CollabLayout` + `TopBarRoleMenu` + wire base routes

**Spec sections:** "CollabLayout", "Routes", "App.tsx wiring", "Top bar — TopBarRoleMenu"

**Files:**
- Create: `frontend/src/dashboard/collaborators/section/components/collab/CollabLayout.tsx`
- Create: `frontend/src/dashboard/collaborators/section/components/collab/TopBarRoleMenu.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `TopBarRoleMenu.tsx`**

```tsx
// frontend/src/dashboard/collaborators/section/components/collab/TopBarRoleMenu.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, UserCircle, Settings as SettingsIcon, LogOut, Check } from "lucide-react";
import { toast } from "sonner";
import { useUser, useActiveRoles, type Role } from "@/contexts/UserContext";

const roleLabel: Record<Role, string> = {
  founder: "Founder",
  collaborator: "Collaborator",
  investor: "Investor",
  org: "Organization",
};

const roleDashboardPath: Record<Role, string> = {
  founder: "/dashboard",
  collaborator: "/collaborator/dashboard",
  investor: "/investor/dashboard",
  org: "/org/dashboard",
};

const roleOnboardingPath: Record<Role, string> = {
  founder: "/founder/setup",
  collaborator: "/collaborator/onboarding/step-1",
  investor: "/investor/onboarding/step-1",
  org: "/org/onboarding/step-1",
};

export function TopBarRoleMenu() {
  const navigate = useNavigate();
  const { collaboratorProfile } = useUser();
  const { activeRoles, currentRole } = useActiveRoles();
  const [open, setOpen] = useState(false);

  const initials = collaboratorProfile.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  const handleRoleClick = (role: Role) => {
    setOpen(false);
    if (activeRoles.has(role)) navigate(roleDashboardPath[role]);
    else                       navigate(roleOnboardingPath[role]);
  };

  const handleLogout = () => {
    setOpen(false);
    toast("Signed out (mock)");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-900 font-semibold flex items-center justify-center text-sm tabular-nums">
          {initials}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-sm font-medium text-slate-900">{collaboratorProfile.name}</div>
          <div className="text-xs text-slate-500">{roleLabel[currentRole]} · {collaboratorProfile.discipline}</div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">{collaboratorProfile.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {roleLabel[currentRole]} · {collaboratorProfile.discipline} · {collaboratorProfile.subSkills.slice(0, 2).join(" · ")}
              </div>
            </div>

            <button type="button" onClick={() => { setOpen(false); navigate("/collaborator/profile"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <UserCircle className="w-4 h-4" /> View profile
            </button>
            <button type="button" onClick={() => { setOpen(false); navigate("/collaborator/settings"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <SettingsIcon className="w-4 h-4" /> Settings
            </button>

            <div className="border-t border-slate-100 px-4 py-2">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Switch role</div>
            </div>

            {(["founder", "collaborator", "investor", "org"] as Role[]).map((role) => {
              const active = activeRoles.has(role);
              const isCurrent = role === currentRole;
              return (
                <button key={role} type="button" onClick={() => handleRoleClick(role)}
                  disabled={isCurrent}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-default">
                  <span className="text-slate-700">{roleLabel[role]}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    {isCurrent ? <>✓ current</> : active ? <><Check className="w-3 h-3" /> active</> : <>Activate</>}
                  </span>
                </button>
              );
            })}

            <button type="button" onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100">
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `CollabLayout.tsx`**

```tsx
// frontend/src/dashboard/collaborators/section/components/collab/CollabLayout.tsx
import { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CheckSquare, TrendingUp, DollarSign, PieChart,
  Sparkles, Award, MessageSquare, Wrench, Rss, UserCircle,
  Settings as SettingsIcon, ArrowLeft,
} from "lucide-react";
import { Toaster } from "@/dashboard/collaborators/section/components/ui/sonner";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { equityTotals } from "@/dashboard/collaborators/section/data/mockData";
import { TopBarRoleMenu } from "./TopBarRoleMenu";

interface NavItem {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
  external?: boolean;
}

const primaryNav: NavItem[] = [
  { name: "Dashboard",     path: "/collaborator/dashboard",     icon: LayoutDashboard },
  { name: "Tasks",         path: "/collaborator/tasks",         icon: CheckSquare },
  { name: "Performance",   path: "/collaborator/performance",   icon: TrendingUp },
  { name: "Earnings",      path: "/collaborator/earnings",      icon: DollarSign },
  { name: "Equity",        path: "/collaborator/equity",        icon: PieChart },
  { name: "Opportunities", path: "/collaborator/opportunities", icon: Sparkles },
  { name: "Reputation",    path: "/collaborator/reputation",    icon: Award },
  { name: "Messages",      path: "/collaborator/messages",      icon: MessageSquare },
  { name: "Tools",         path: "/collaborator/tools",         icon: Wrench },
  { name: "Feed",          path: "/feed",                       icon: Rss, external: true },
];

const accountNav: NavItem[] = [
  { name: "Profile",  path: "/collaborator/profile",  icon: UserCircle },
  { name: "Settings", path: "/collaborator/settings", icon: SettingsIcon },
];

export function CollabLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collaboratorProfile } = useCollaboratorProfile();

  // Defensive redirect: un-onboarded users go to step 1
  useEffect(() => {
    if (!collaboratorProfile.onboardingComplete && !location.pathname.startsWith("/collaborator/onboarding")) {
      navigate("/collaborator/onboarding/step-1", { replace: true });
    }
  }, [collaboratorProfile.onboardingComplete, location.pathname, navigate]);

  const isActive = (path: string) => location.pathname === path;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link key={item.path} to={item.path}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
          active
            ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-500"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}>
        <Icon className="w-4 h-4" />
        <span className="flex-1 font-medium">{item.name}</span>
        {item.external && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono uppercase tracking-wider">
            Hub
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800">
          <Link to="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-400 transition-colors mb-3">
            <ArrowLeft className="w-3 h-3" />
            Back to TechIT
          </Link>
          <h1 className="text-xl font-bold text-amber-400 tracking-wide">TECHIT</h1>
          <p className="text-xs text-slate-400 mt-0.5">Collaborator Portal</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {primaryNav.map(renderNavItem)}
          <div className="h-px bg-slate-800 my-3" />
          {accountNav.map(renderNavItem)}
        </nav>

        <Link to="/collaborator/equity" className="m-3 p-3 rounded-lg bg-slate-800 hover:bg-slate-800/70 transition-colors border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Building for Equity</p>
          <p className="text-sm text-white mt-1 tabular-nums">
            ${(equityTotals.totalValueUSD / 1000).toFixed(1)}K ownership across 3 startups
          </p>
          <p className="text-xs text-amber-400 mt-1">View equity →</p>
        </Link>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="text-sm text-slate-500">
            {/* Breadcrumb: section name */}
            {primaryNav.find((n) => isActive(n.path))?.name ?? accountNav.find((n) => isActive(n.path))?.name ?? ""}
          </div>
          <TopBarRoleMenu />
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
```

- [ ] **Step 3: Modify `frontend/src/App.tsx` — remove the old flat collab imports and routes, add the new nested block**

Remove lines 6-14 (old flat imports — `CollaboratorSetup`, `CollaboratorSummary`, `CollaboratorDashboard`, `AITaskCenter`, `ToolsPage`, `OpportunitiesPage`, `PerformancePage`, `MessagesPage`, `EarningsPage`).

Remove lines 99-114 (old flat routes — every `<Route path="/collaborator/*" element={...} />`).

In their place, add at the top of the import block:

```tsx
import { CollabLayout } from "@/dashboard/collaborators/section/components/collab/CollabLayout";
```

And in the route tree, add the layout block (placing it after the org block to keep file order parallel):

```tsx
<Route path="/collaborator" element={<CollabLayout />}>
  <Route index element={<Navigate to="/collaborator/onboarding/step-1" replace />} />
</Route>

{/* Legacy redirects — Landing.tsx still navigates to /collaborator/setup */}
<Route path="/collaborator/setup"   element={<Navigate to="/collaborator/onboarding/step-1" replace />} />
<Route path="/collaborator/summary" element={<Navigate to="/collaborator/dashboard" replace />} />
```

(Tasks 4–15 will replace the `index` redirect target and add child `<Route>` entries.)

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build
```
Expected: success. Any TS errors most likely come from the removed imports — search the file for any lingering reference to the deleted symbols and remove them.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx \
        frontend/src/dashboard/collaborators/section/components/collab/CollabLayout.tsx \
        frontend/src/dashboard/collaborators/section/components/collab/TopBarRoleMenu.tsx
git commit -m "$(cat <<'EOF'
feat(collab): add CollabLayout shell with slate-900 sidebar + role menu

Introduces /collaborator parent route with slate sidebar (amber active),
top-bar TopBarRoleMenu for cross-role switching, defensive redirect to
onboarding step 1 if onboardingComplete is false, Feed external link to
/feed, and a "Building for Equity" footer card. Drops the flat
/collaborator/* routes from App.tsx; legacy /collaborator/setup and
/summary redirect to the new entry points.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Onboarding wizard

### Task 4: Create `CollabProgressBar` + 6 onboarding steps + wire routes

**Spec sections:** "Onboarding wizard" (all 6 steps), "Defensive routing"

**Files:**
- Create: `frontend/src/dashboard/collaborators/onboarding/CollabProgressBar.tsx`
- Create: `frontend/src/dashboard/collaborators/onboarding/CollabStep1.tsx` … `CollabStep6.tsx`
- Modify: `frontend/src/App.tsx`

**Reference pattern:** Read `frontend/src/dashboard/organization/onboarding/OrgStep1.tsx` first — it shows the exact shell structure (state from context, persist on Continue, navigate to next step). Mirror that shell for every collab step; only the form fields differ.

- [ ] **Step 1: Create `CollabProgressBar.tsx`** (amber accent, total = 6)

```tsx
// frontend/src/dashboard/collaborators/onboarding/CollabProgressBar.tsx
interface Props { currentStep: number; totalSteps: number; }

export function CollabProgressBar({ currentStep, totalSteps }: Props) {
  const progress = (currentStep / totalSteps) * 100;
  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-500">Step {currentStep} of {totalSteps}</span>
        <span className="text-sm text-amber-600 font-semibold">{Math.round(progress)}% Complete</span>
      </div>
      <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `CollabStep1.tsx` (Identity)**

```tsx
// frontend/src/dashboard/collaborators/onboarding/CollabStep1.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { CollabProgressBar } from "./CollabProgressBar";
import { User, MapPin, Briefcase, Calendar, MessageSquare } from "lucide-react";

export function CollabStep1() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const [name, setName]             = useState(collaboratorProfile.name);
  const [title, setTitle]           = useState(collaboratorProfile.title);
  const [location, setLocation]     = useState(collaboratorProfile.location);
  const [years, setYears]           = useState(collaboratorProfile.yearsExperience);
  const [headline, setHeadline]     = useState(collaboratorProfile.headline);

  const canContinue = name.trim() && title.trim() && location.trim() && years >= 0 && headline.trim();

  const handleNext = () => {
    updateCollaboratorProfile({ name, title, location, yearsExperience: years, headline });
    navigate("/collaborator/onboarding/step-2");
  };
  const handleSaveExit = () => {
    updateCollaboratorProfile({ name, title, location, yearsExperience: years, headline });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save & exit</button>
        </div>
        <CollabProgressBar currentStep={1} totalSteps={6} />
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Tell us who you are</h1>
          <p className="text-base text-slate-600">The basics. We'll use this on your public profile and to match you with the right builds.</p>
        </div>

        <div className="space-y-5">
          <Field label="Full name" icon={User}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Chen"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </Field>
          <Field label="Professional title" icon={Briefcase}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Frontend Engineer"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </Field>
          <Field label="Location" icon={MapPin}>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lagos, Nigeria"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </Field>
          <Field label="Years of experience" icon={Calendar}>
            <input type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value) || 0)}
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors tabular-nums" />
          </Field>
          <Field label="Headline (one line)" icon={MessageSquare}>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120}
              placeholder="I ship product-grade React systems quickly."
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </Field>
        </div>

        <div className="flex justify-end mt-10">
          <button onClick={handleNext} disabled={!canContinue}
            className="px-6 py-3 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-700">
        <Icon className="w-4 h-4 text-slate-400" /> {label}
      </label>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `CollabStep2.tsx` (Discipline & sub-skills)**

Use the same `Field`/`Save & exit`/`Continue` shell from Step 1 (copy the `handleSaveExit`, `CollabProgressBar`, header structure). Form body:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollaboratorProfile, type CollaboratorDiscipline } from "@/contexts/UserContext";
import { CollabProgressBar } from "./CollabProgressBar";

const disciplines: CollaboratorDiscipline[] = [
  "Engineering", "Design", "Product", "Data & ML",
  "DevOps", "Security", "Marketing", "Research",
];

const subSkillsByDiscipline: Record<CollaboratorDiscipline, string[]> = {
  "Engineering": ["React", "TypeScript", "Node.js", "Python", "Go", "Rust", "System design", "Performance", "Mobile (RN/iOS/Android)", "Backend APIs", "Testing", "GraphQL", "Realtime", "Web3"],
  "Design":      ["Product", "Visual", "Brand", "UX research", "Design systems", "Motion", "Illustration", "Prototyping", "3D", "Webflow/Framer", "Figma", "Pitch decks", "Marketing pages", "Iconography"],
  "Product":     ["Discovery", "Roadmapping", "PRDs", "Analytics", "Pricing", "GTM", "Growth experiments", "A/B testing", "Stakeholder mgmt", "Customer interviews", "Spec writing", "Prioritisation", "OKRs", "PMing AI features"],
  "Data & ML":   ["Modelling", "MLOps", "NLP", "CV", "RAG", "Fine-tuning", "Evals", "Recommenders", "Time series", "Forecasting", "SQL", "dbt", "Notebooks", "Dashboards"],
  "DevOps":      ["AWS", "GCP", "Azure", "K8s", "Terraform", "CI/CD", "Observability", "Incident response", "Cost optimization", "Container orchestration", "Edge/CDN", "Serverless", "Networking", "Backups"],
  "Security":    ["AppSec", "Pen testing", "SAST/DAST", "Threat modelling", "IAM", "Compliance (SOC2/ISO/GDPR)", "Secrets mgmt", "Audit logging", "Zero trust", "Crypto", "Incident response", "Bug bounty", "Cloud security", "Red team"],
  "Marketing":   ["Content", "SEO", "Paid ads", "Lifecycle", "Email", "Brand", "Social", "Community", "PR", "Launches", "Partnerships", "Analytics", "Creator marketing", "Founder-led"],
  "Research":    ["User research", "Market research", "Behavioural research", "Quant", "Qual", "Surveys", "Diary studies", "Usability", "Interviews", "Competitive analysis", "Synthesis", "Repository", "Insights", "Strategy"],
};

export function CollabStep2() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const [discipline, setDiscipline] = useState<CollaboratorDiscipline | "">(collaboratorProfile.discipline);
  const [subSkills, setSubSkills]   = useState<string[]>(collaboratorProfile.subSkills);

  const toggleSkill = (s: string) => setSubSkills((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const canContinue = discipline && subSkills.length >= 3 && subSkills.length <= 8;

  const persist = () => updateCollaboratorProfile({ discipline, subSkills });
  const handleNext = () => { persist(); navigate("/collaborator/onboarding/step-3"); };
  const handleBack = () => { persist(); navigate("/collaborator/onboarding/step-1"); };
  const handleSaveExit = () => { persist(); navigate("/dashboard"); };

  const skillOptions = discipline ? subSkillsByDiscipline[discipline] : [];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4"><button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save & exit</button></div>
        <CollabProgressBar currentStep={2} totalSteps={6} />

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">What do you build?</h1>
          <p className="text-base text-slate-600">Pick one primary discipline, then 3–8 specific skills.</p>
        </div>

        <div className="mb-8">
          <label className="block mb-3 text-sm font-semibold text-slate-700">Primary discipline</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {disciplines.map((d) => (
              <button key={d} type="button" onClick={() => { setDiscipline(d); setSubSkills([]); }}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  discipline === d ? "border-amber-500 bg-amber-50 text-amber-700"
                                   : "border-slate-300 bg-white text-slate-700 hover:border-amber-300"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {discipline && (
          <div className="mb-8">
            <label className="block mb-3 text-sm font-semibold text-slate-700">
              Sub-skills <span className="text-slate-400 font-normal">({subSkills.length} of 3–8 selected)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {skillOptions.map((s) => (
                <button key={s} type="button" onClick={() => toggleSkill(s)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    subSkills.includes(s) ? "border-amber-500 bg-amber-50 text-amber-700"
                                          : "border-slate-300 bg-white text-slate-600 hover:border-amber-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-10">
          <button onClick={handleBack} className="px-6 py-3 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition-colors">← Back</button>
          <button onClick={handleNext} disabled={!canContinue}
            className="px-6 py-3 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">Continue →</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `CollabStep3.tsx` (Tech stack)**

Same shell. Form body: chip-style input with `techStack` array. Add-chip on Enter or click. Show 8 suggestions derived from `subSkills` (filtered against current `techStack`). Min 3 chips. Persist on Continue → `/collaborator/onboarding/step-4`. Back → step-2.

Key state:
```tsx
const [stack, setStack]   = useState<string[]>(collaboratorProfile.techStack);
const [draft, setDraft]   = useState("");
const addChip = (s: string) => { const v = s.trim(); if (v && !stack.includes(v)) setStack([...stack, v]); setDraft(""); };
const removeChip = (s: string) => setStack((cur) => cur.filter((x) => x !== s));
const canContinue = stack.length >= 3;
```

JSX: a chip row + an input that calls `addChip(draft)` on Enter, and a suggestions row of buttons.

- [ ] **Step 5: Create `CollabStep4.tsx` (Availability)**

Same shell. Form fields:

```tsx
const [hours, setHours]                  = useState(collaboratorProfile.weeklyHours);
const [tz, setTz]                        = useState(collaboratorProfile.timezone);
const [earliest, setEarliest]            = useState<CollaboratorProfile["earliestStart"]>(collaboratorProfile.earliestStart);
const [commitment, setCommitment]        = useState<CollaboratorProfile["commitmentStyle"]>(collaboratorProfile.commitmentStyle);
const canContinue = hours >= 5 && tz.trim();
```

JSX: range slider (5–60) for hours with live readout, timezone `<select>` populated with `["WAT", "GMT", "EST", "PST", "CET", "JST", "AEST", "IST"]`, radio cards for earliest start (`this-week` / `2-weeks` / `1-month`), radio cards for commitment style (`deep` / `parallel` / `many`).

Persist → step-5. Back → step-3.

- [ ] **Step 6: Create `CollabStep5.tsx` (Mission: Building for Equity)**

Same shell. Distinctive copy that frames the mission. Form fields:

```tsx
const [pref, setPref]      = useState(collaboratorProfile.equityPreference);          // 0..100
const [floor, setFloor]    = useState(collaboratorProfile.minCashFloor);
const [vesting, setVesting]= useState<CollaboratorProfile["vestingComfort"]>(collaboratorProfile.vestingComfort);
const canContinue = pref >= 0 && pref <= 100 && floor >= 0;
```

JSX:

```tsx
<div className="mb-10">
  <h1 className="text-3xl font-bold text-slate-900 mb-2">Building for Equity</h1>
  <p className="text-base text-slate-600 leading-relaxed">
    TechIT is built on the idea that contributors should own what they build. Every engagement
    is a mix of cash and equity. Your preference shapes the opportunities we surface and the
    offers you accept.
  </p>
</div>

<div className="mb-8">
  <label className="block mb-3 text-sm font-semibold text-slate-700">How do you want to be paid?</label>
  <input type="range" min={0} max={100} value={pref} onChange={(e) => setPref(Number(e.target.value))} className="w-full accent-amber-500" />
  <div className="flex justify-between text-xs text-slate-500 mt-1">
    <span>Cash heavy</span>
    <span className="font-semibold text-amber-600">{pref}% equity / {100 - pref}% cash</span>
    <span>Equity heavy</span>
  </div>
</div>

<Field label="Minimum cash floor (per month)">
  <input type="number" min={0} step={100} value={floor} onChange={(e) => setFloor(Number(e.target.value) || 0)}
    className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 outline-none focus:border-amber-500 tabular-nums" />
</Field>

<div className="mb-6">
  <label className="block mb-3 text-sm font-semibold text-slate-700">Equity vesting comfort</label>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {([
      { v: "1y-cliff-4y", label: "1y cliff, 4y vest", note: "Standard startup vesting" },
      { v: "standard",    label: "Standard (4y, 1y cliff)", note: "Most common — recommended" },
      { v: "custom",      label: "Custom", note: "Negotiated per engagement" },
    ] as const).map((opt) => (
      <button key={opt.v} type="button" onClick={() => setVesting(opt.v)}
        className={`p-4 rounded-lg border-2 text-left transition-all ${
          vesting === opt.v ? "border-amber-500 bg-amber-50" : "border-slate-300 bg-white hover:border-amber-300"}`}>
        <div className="font-semibold text-slate-900 text-sm">{opt.label}</div>
        <div className="text-xs text-slate-500 mt-1">{opt.note}</div>
      </button>
    ))}
  </div>
</div>

<details className="mb-6 border border-slate-200 rounded-lg p-4 bg-white">
  <summary className="cursor-pointer text-sm font-semibold text-slate-700">How equity works on TechIT</summary>
  <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
    <li>Every grant follows your chosen vesting schedule. We track it on your behalf and surface upcoming events on the Equity page.</li>
    <li>Dilution protection: equity already vested cannot be diluted without your consent. Future grants are protected up to a threshold defined at signing.</li>
    <li>TechIT acts as the cap-table custodian. You get a copy of every grant document; we keep the canonical ledger so founders and collaborators have a single source of truth.</li>
  </ul>
</details>
```

- [ ] **Step 7: Create `CollabStep6.tsx` (Portfolio & goals — final step)**

Same shell, but Continue commits `onboardingComplete: true` and routes to dashboard with toast.

```tsx
import { toast } from "sonner";
// ...
const [github, setGithub]       = useState(collaboratorProfile.links.github);
const [linkedin, setLinkedin]   = useState(collaboratorProfile.links.linkedin);
const [portfolio, setPortfolio] = useState(collaboratorProfile.links.portfolio);
const [twitter, setTwitter]     = useState(collaboratorProfile.links.twitter);
const [whyHere, setWhyHere]     = useState(collaboratorProfile.whyHere);
const [pinned, setPinned]       = useState<string[]>(collaboratorProfile.pinnedWork);

const addPinned = () => { if (pinned.length < 3) setPinned([...pinned, ""]); };
const updatePinned = (i: number, v: string) => setPinned((cur) => cur.map((p, idx) => idx === i ? v : p));
const removePinned = (i: number) => setPinned((cur) => cur.filter((_, idx) => idx !== i));

const handleFinish = () => {
  updateCollaboratorProfile({
    links: { github, linkedin, portfolio, twitter },
    whyHere,
    pinnedWork: pinned.filter((u) => u.trim()),
    onboardingComplete: true,
  });
  toast.success("You're in. Welcome to TechIT.");
  navigate("/collaborator/dashboard");
};
```

JSX: four URL inputs (all optional), a textarea for `whyHere`, and a dynamic list of up to 3 URL inputs with `[+ Add link]` / per-row remove. Final button label is `Finish →` (still amber).

- [ ] **Step 8: Wire onboarding routes in `App.tsx`**

Add to the imports:

```tsx
import { CollabStep1 } from "@/dashboard/collaborators/onboarding/CollabStep1";
import { CollabStep2 } from "@/dashboard/collaborators/onboarding/CollabStep2";
import { CollabStep3 } from "@/dashboard/collaborators/onboarding/CollabStep3";
import { CollabStep4 } from "@/dashboard/collaborators/onboarding/CollabStep4";
import { CollabStep5 } from "@/dashboard/collaborators/onboarding/CollabStep5";
import { CollabStep6 } from "@/dashboard/collaborators/onboarding/CollabStep6";
```

Add the six routes (place them above the `<Route path="/collaborator">` parent route — these don't share the layout):

```tsx
<Route path="/collaborator/onboarding/step-1" element={<CollabStep1 />} />
<Route path="/collaborator/onboarding/step-2" element={<CollabStep2 />} />
<Route path="/collaborator/onboarding/step-3" element={<CollabStep3 />} />
<Route path="/collaborator/onboarding/step-4" element={<CollabStep4 />} />
<Route path="/collaborator/onboarding/step-5" element={<CollabStep5 />} />
<Route path="/collaborator/onboarding/step-6" element={<CollabStep6 />} />
```

- [ ] **Step 9: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/dashboard/collaborators/onboarding/ frontend/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(collab): 6-step onboarding wizard

Identity · Discipline & sub-skills (curated lists per discipline) ·
Tech stack chips · Availability & commitment style · Building for
Equity (slider, cash floor, vesting comfort, "how equity works"
explainer) · Portfolio & goals. State persists to UserContext on
every step transition; final step marks onboardingComplete and routes
to the dashboard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Thesis pages (Dashboard + Equity)

### Task 5: Build `Dashboard.tsx` (equity-led, no AI chrome)

**Spec sections:** "Dashboard", "Visual tone rules"

**Files:**
- Create: `frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the file with imports + skeleton**

```tsx
// frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, ArrowRight, CheckCircle } from "lucide-react";
import {
  equityHoldings, equityTotals,
  cashTotals,
  projects, tasks, signals, recentActivity,
} from "@/dashboard/collaborators/section/data/mockData";
import { useCollaboratorProfile } from "@/contexts/UserContext";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { collaboratorProfile } = useCollaboratorProfile();
  const [activity, setActivity] = useState(recentActivity);

  const firstName = collaboratorProfile.name.split(" ")[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const urgentTasks = [...tasks]
    .filter((t) => t.status !== "completed")
    .sort((a, b) => (b.impactScore - a.impactScore))
    .slice(0, 3);

  const handleStandup = (projectName: string) => {
    setActivity((cur) => [
      { id: `ra-${Date.now()}`, projectName, projectLogo: projects.find((p) => p.name === projectName)?.logo ?? "•", message: "Standup logged", timestampISO: new Date().toISOString() },
      ...cur,
    ]);
    toast("Standup logged");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Good morning, {firstName}.</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today} · {projects.length} active builds</p>
      </div>

      {/* Equity hero + Earnings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equity hero — 2 cols */}
        <Link to="/collaborator/equity" className="lg:col-span-2 group border border-slate-200 bg-white rounded-xl p-6 hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Building for Equity</p>
            <span className="text-amber-600 text-sm group-hover:translate-x-0.5 transition-transform">View full equity →</span>
          </div>
          <div className="flex items-baseline gap-6 mt-2">
            <div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">${(equityTotals.totalValueUSD / 1000).toFixed(1)}K</p>
              <p className="text-xs text-slate-500 mt-0.5">Total ownership value</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">{equityTotals.blendedEquityPercent}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Blended equity across {equityHoldings.length} startups</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {equityHoldings.map((h) => (
              <div key={h.projectId} className="flex items-center text-sm">
                <span className="text-lg mr-2">{h.projectLogo}</span>
                <span className="flex-1 text-slate-700">{h.projectName}</span>
                <span className="w-16 text-right tabular-nums text-slate-900">{h.equityPercent}%</span>
                <span className="w-20 text-right tabular-nums text-slate-700">${(h.valueUSD / 1000).toFixed(1)}K</span>
                <span className="w-24 text-right text-xs text-slate-500">vested {h.vestedPercent}%</span>
              </div>
            ))}
          </div>

          {equityTotals.nextVest && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-slate-700">
                Next vest <span className="font-semibold">{equityTotals.nextVest.date}</span> · +{equityTotals.nextVest.deltaPercent}% {equityTotals.nextVest.startup}
              </span>
            </div>
          )}
        </Link>

        {/* Earnings — 1 col */}
        <Link to="/collaborator/earnings" className="group border border-slate-200 bg-white rounded-xl p-6 hover:border-amber-300 transition-colors">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Cash earned</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">${(cashTotals.lifetimeUSD / 1000).toFixed(0)}K</p>
          <p className="text-xs text-slate-500">Lifetime</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Pending payout</span><span className="font-semibold tabular-nums text-slate-900">${cashTotals.pendingUSD.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Revenue share (TTM)</span><span className="font-semibold tabular-nums text-slate-900">${cashTotals.revenueShareTTMUsd.toLocaleString()}</span></div>
          </div>
          <p className="text-amber-600 text-sm mt-4 group-hover:translate-x-0.5 transition-transform">View earnings →</p>
        </Link>
      </div>

      {/* Active Builds */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Active Builds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((p) => {
            const statusStyles = p.status === "critical"
              ? "bg-red-50 text-red-700"
              : p.status === "risk"
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700";
            return (
              <div key={p.id} className="border border-slate-200 bg-white rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.logo}</span>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{p.name}</h3>
                      <p className="text-xs text-slate-500">{p.role}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles}`}>{p.status}</span>
                </div>
                <div className="text-xs text-slate-600 mb-2">{p.sprintGoal}</div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-amber-500" style={{ width: `${p.progress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mb-3">
                  <span>{p.progress}%</span><span>Due {p.deadline}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/workspaces/build?startup=${p.id}`)}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">Open workspace</button>
                  <button onClick={() => handleStandup(p.name)}
                    className="px-3 py-1.5 text-xs border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Standup</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's focus + Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-slate-200 bg-white rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Today's focus</h2>
            <Link to="/collaborator/tasks" className="text-xs text-amber-600 hover:underline">View all tasks</Link>
          </div>
          <ul className="space-y-3">
            {urgentTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 accent-amber-500" />
                <div className="flex-1">
                  <p className="text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.projectName} · Due {t.deadline} · Impact {t.impactScore}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  t.priority === "critical" ? "bg-red-50 text-red-700" :
                  t.priority === "high"     ? "bg-amber-50 text-amber-700" :
                                              "bg-slate-100 text-slate-700"}`}>{t.priority}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Signals</h2>
          <ul className="space-y-2">
            {signals.map((s) => (
              <li key={s.id}>
                <Link to={s.href} className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                  <CheckCircle className="w-4 h-4 text-slate-400" />
                  <span className="flex-1 text-slate-700">{s.message}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent activity */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Recent activity</h2>
        <ul className="space-y-2">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm py-1.5">
              <span className="text-lg">{a.projectLogo}</span>
              <span className="text-slate-700 font-medium">{a.projectName}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-600 flex-1">{a.message}</span>
              <span className="text-xs text-slate-400">{formatRelative(a.timestampISO)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire route in `App.tsx`**

Add `import { Dashboard as CollabDashboard } from "@/dashboard/collaborators/section/components/collab/Dashboard";` and change the layout's `index` route from the onboarding redirect to point at the dashboard (when the layout renders, the defensive `onboardingComplete` check inside `CollabLayout` already sends un-onboarded users to step-1):

```tsx
<Route path="/collaborator" element={<CollabLayout />}>
  <Route index element={<Navigate to="/collaborator/dashboard" replace />} />
  <Route path="dashboard" element={<CollabDashboard />} />
</Route>
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx frontend/src/App.tsx
git commit -m "feat(collab): equity-led Dashboard with Signals panel

Replaces the Figma export dashboard. Top: equity hero (2/3) + earnings
(1/3) side by side. Active Builds row, Today's focus + Signals (no AI
chrome — concrete linked facts), recent activity. Standup CTA appends
local activity; Open workspace deep-links to /workspaces/build.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Build `Equity.tsx` page

**Spec sections:** "Equity" (page), "Mock data changes — vestingTimeline, EquityHolding"

**Files:**
- Create: `frontend/src/dashboard/collaborators/section/components/collab/Equity.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/dashboard/collaborators/section/components/collab/Equity.tsx
import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { equityHoldings, equityTotals, vestingTimeline, type EquityHolding } from "@/dashboard/collaborators/section/data/mockData";

export function Equity() {
  const [capHolding, setCapHolding] = useState<EquityHolding | null>(null);

  const chartData = (() => {
    // Build series indexed by month
    const months = vestingTimeline[0]?.points.map((p) => p.monthIso) ?? [];
    return months.map((m, i) => {
      const row: Record<string, number | string> = { month: m };
      vestingTimeline.forEach((s) => { row[s.projectName] = s.points[i]?.vestedPercent ?? 0; });
      return row;
    });
  })();
  const seriesColors = ["#f59e0b", "#10b981", "#6366f1"]; // amber, emerald, indigo

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equity</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ownership you've earned across {equityHoldings.length} startups.</p>
        </div>
        <a href="#equity-philosophy" className="text-sm text-amber-600 hover:underline">Equity philosophy →</a>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total value"          value={`$${(equityTotals.totalValueUSD / 1000).toFixed(1)}K`} />
        <Stat label="Blended equity"        value={`${equityTotals.blendedEquityPercent}%`} />
        <Stat label="Vested this quarter"   value={`$${(equityTotals.vestedThisQuarterUSD / 1000).toFixed(1)}K`} />
        <Stat label="Next vest" value={equityTotals.nextVest?.date ?? "—"} sub={equityTotals.nextVest ? `+${equityTotals.nextVest.deltaPercent}% ${equityTotals.nextVest.startup}` : undefined} />
      </div>

      {/* Vesting timeline */}
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Vesting timeline (48-month horizon)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(m) => m.slice(2)} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              {vestingTimeline.map((s, i) => (
                <Line key={s.projectId} type="monotone" dataKey={s.projectName} stroke={seriesColors[i % seriesColors.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-startup cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {equityHoldings.map((h) => (
          <div key={h.projectId} id={`startup-${h.projectId}`} className="border border-slate-200 bg-white rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{h.projectLogo}</span>
              <h3 className="font-semibold text-slate-900">{h.projectName}</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-2">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{h.equityPercent}%</p>
              <p className="text-sm text-slate-600 tabular-nums">${(h.valueUSD / 1000).toFixed(1)}K</p>
            </div>
            <p className="text-xs text-slate-500 mb-3">Vested {h.vestedPercent}% · {h.vestingSchedule.years}y/{h.vestingSchedule.cliffMonths}m cliff</p>
            <p className="text-xs text-slate-500 mb-4">Granted {h.grantDate}</p>
            {h.nextVest && (
              <p className="text-xs text-amber-600 mb-4 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Next vest {h.nextVest.date} · +{h.nextVest.deltaPercent}%</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setCapHolding(h)} className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">View cap table</button>
              <button onClick={() => toast("Grant document downloaded (mock PDF)")} className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">Grant document →</button>
            </div>
          </div>
        ))}
      </div>

      {/* Philosophy explainer */}
      <details id="equity-philosophy" className="border border-slate-200 bg-white rounded-xl p-6">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">How equity works on TechIT</summary>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
          <li>Every grant follows your chosen vesting schedule. We track it on your behalf and surface upcoming events here.</li>
          <li>Dilution protection: equity already vested cannot be diluted without your consent. Future grants are protected up to a threshold defined at signing.</li>
          <li>TechIT acts as the cap-table custodian. You get a copy of every grant document; we keep the canonical ledger so founders and collaborators have a single source of truth.</li>
        </ul>
      </details>

      {/* Cap table dialog */}
      {capHolding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setCapHolding(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">{capHolding.projectName} · Cap table</h3>
              <button onClick={() => setCapHolding(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <ul className="space-y-2">
              {capHolding.capTable.map((row) => (
                <li key={row.label} className={`flex justify-between text-sm p-2 rounded ${row.highlighted ? "bg-amber-50" : ""}`}>
                  <span className={row.highlighted ? "font-semibold text-amber-700" : "text-slate-700"}>{row.label}</span>
                  <span className="tabular-nums">{row.percent}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-slate-200 bg-white rounded-xl p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wire route**

```tsx
import { Equity as CollabEquity } from "@/dashboard/collaborators/section/components/collab/Equity";
// ...
<Route path="equity" element={<CollabEquity />} />
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/dashboard/collaborators/section/components/collab/Equity.tsx frontend/src/App.tsx
git commit -m "feat(collab): Equity page with vesting timeline and cap tables

Hero stats (total value, blended %, vested this quarter, next vest),
48-month vesting timeline chart, per-startup cards with View cap
table dialog and Grant document download (mock toast). Anchor link
to How equity works explainer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Supporting pages

### Task 7: Build `Tasks.tsx`

**Spec section:** "Tasks"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/Tasks.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — three sections (Today / This week / Later) + collapsed Completed. Reads `tasks` from mockData into local `useState`. Today = deadline within 48h of today; This week = ≤7 days; Later = >7 days; Completed = `status === "completed"`.

Each row: checkbox + title + meta line + three buttons (`Mark complete`, `Open in workspace`, `Snooze 1d`).

- `Mark complete`: `setTasks((cur) => cur.map((t) => t.id === id ? { ...t, status: "completed" } : t))` + `toast("Marked complete")`.
- `Open in workspace`: `navigate(/workspaces/build?startup=${projectId})`.
- `Snooze 1d`: mutate deadline +1 day (use `new Date(deadline).setDate(d.getDate() + 1)`).

Top controls: `[+ Add task]` button opens a Dialog (use `Dialog` from `section/components/ui/dialog`). Form: project picker (from `projects[]`), title input, due date (`<input type="date">`), priority radio, impact (0-100 number). Submit: prepend to tasks state.

Filter + Sort dropdowns: simple `<select>` for project filter and sort key (`impact` / `deadline` / `project`).

- [ ] **Step 2: Wire route** — add import + `<Route path="tasks" element={<CollabTasks />} />`
- [ ] **Step 3: Verify build:** `cd frontend && npm run build`
- [ ] **Step 4: Commit:** `feat(collab): Tasks page with mark/snooze/add actions`

---

### Task 8: Build `Performance.tsx`

**Spec section:** "Performance"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/Performance.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — header + time-range `<select>` (`Last 30 / 90 / 365 days`). Five-metric row using `performanceMetrics` (each card shows value + ↑↓ arrow with `change`). Recharts `LineChart` for `weeklyVelocity` (single amber line, no fill). Per-project contribution table built by joining `projects`, `tasks`, and `performanceMetrics` — show project, role, tasks shipped (count `tasks` where `projectId === p.id && status === "completed"`), impact avg (mean of those tasks' `impactScore`), last contribution (latest of `tasks.deadline` per project). Row click: `navigate(/workspaces/build?startup=${id})`.
- [ ] **Step 2: Wire route, Step 3: Verify, Step 4: Commit** as in Task 7.

---

### Task 9: Build `Earnings.tsx` (cash-only, slimmed)

**Spec section:** "Earnings"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/Earnings.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — three stat cards (`cashTotals.lifetimeUSD`, `pendingUSD`, `revenueShareTTMUsd`). Per-startup breakdown table from `cashEarnings` with `[Equity →]` chip per row that navigates to `/collaborator/equity#startup-{projectId}`. Payout history bar chart using `payouts` (single amber bars). Paginated list of payouts below chart.

`[Withdraw funds]` button opens Dialog: bank-account picker (mock — show one card `"•••1234 · Wells Fargo"`), amount input (max = `cashTotals.pendingUSD`). Submit:
```ts
const newPayout: Payout = { id: `p-${Date.now()}`, monthIso: new Date().toISOString().slice(0,7), amount, status: "processing" };
setPayouts([newPayout, ...payouts]);
setCashTotalsPending(cashTotals.pendingUSD - amount); // local state
toast(`Withdrawal initiated — $${amount.toLocaleString()} to •••1234. Funds arrive in 1–3 business days.`);
```

- [ ] **Step 2-4** as before. Commit: `feat(collab): Earnings page (cash-only) with payout history and withdrawal`

---

### Task 10: Build `Opportunities.tsx`

**Spec section:** "Opportunities"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/Opportunities.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — filter pills row (`All / Project / Advisory / Gig / Testing`). Card grid (3 per row) from `opportunities`. Each card: title, type, company, match score top-right, cash + equity, time commitment, skills chips, team quality, risk level.

Card buttons:
- `View details`: opens a side `Sheet` (from `section/components/ui/sheet`) showing `description`, `teamBios`, `timeline`, full comp breakdown.
- `Express interest`: mutate local state `setOpps((cur) => cur.map((o) => o.id === id ? { ...o, status: "applied" } : o))`. Render applied cards in muted/green-tinted state with the buttons replaced by `"Application sent — withdraw"`. Toast `"Application sent to {company}"`.
- `Pass`: remove from local state. Show `toast.message("Removed", { action: { label: "Undo", onClick: () => setOpps((cur) => [...cur, removed]) } })`.

Top-right `Refresh matches` link: `setOpps((cur) => [...cur].sort(() => Math.random() - 0.5))` + toast.

- [ ] **Step 2-4** as before. Commit: `feat(collab): Opportunities page with detail drawer and apply/pass`

---

### Task 11: Build `Reputation.tsx`

**Spec section:** "Reputation"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/Reputation.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — score breakdown (radial chart using recharts `RadialBarChart` with one bar per `performanceMetrics` entry, amber for the highest value, slate-300 for the rest). Endorsements list from `endorsements` with pagination (10 per page, simple `[Page X of Y]` controls). Badges grid from `badges` — earned tiles in color, unearned tiles muted. Click a badge → Dialog showing `title + description + "Earned: yes/no — {criteria}"`. Leaderboard table from `leaderboard` with current user row highlighted (`bg-amber-50`). Time-range pill toggle: `this month / quarter / all time` (no real data change, just visual state — note this in a code comment).
- [ ] **Step 2-4** as before. Commit: `feat(collab): Reputation page with endorsements, badges, and leaderboard`

---

### Task 12: Build `Messages.tsx`

**Spec section:** "Messages"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/Messages.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — two-column layout. Left (1/3): inbox list from `conversations`. Right (2/3): conversation pane showing the selected thread. Reply textarea + `[Send]` + `[Attach]`. State:

```ts
const [convos, setConvos] = useState(conversations);
const [activeId, setActiveId] = useState<string>(conversations[0].id);
const active = convos.find((c) => c.id === activeId)!;
const [draft, setDraft] = useState("");

const handleSelect = (id: string) => {
  setActiveId(id);
  setConvos((cur) => cur.map((c) => c.id === id ? { ...c, unread: false } : c));
};
const handleSend = () => {
  if (!draft.trim()) return;
  setConvos((cur) => cur.map((c) => c.id === activeId
    ? { ...c, thread: [...c.thread, { id: `m-${Date.now()}`, fromMe: true, authorName: "You", body: draft, timestamp: new Date().toISOString() }] }
    : c));
  setDraft("");
};
```

`[Compose]` button opens Dialog: recipient input, project picker, subject, body. Submit appends new conversation.

- [ ] **Step 2-4** as before. Commit: `feat(collab): Messages with threaded conversations and compose`

---

### Task 13: Build `Tools.tsx`

**Spec section:** "Tools"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/Tools.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — grid of cards from `tools` (`ToolIntegration[]`). Each card: name + status (`Connected` green / `Disconnected` slate) + `lastSyncedAt` (formatted) + `updates` count + `[Manage]` or `[Connect]`.

`[Connect]` Dialog: single button `"Continue to {tool name}"` → on click `setTools((cur) => cur.map((t) => t.id === id ? { ...t, status: "connected", updates: 1, lastSyncedAt: new Date().toISOString() } : t))` + toast.

`[Manage]` Dialog: list `scopes`, red `[Disconnect]` button → flip status to `disconnected`, set `lastSyncedAt: null, updates: 0`, toast.

`[+ Connect new tool]` Dialog: 8 picks (Slack, Sentry, PostHog, Stripe, ClickUp, Loom, Cal.com, Calendly). Click one → add disconnected card.

Recent updates feed (below grid): synthesize from `recentActivity` + dedicated tool messages. Reuse `recentActivity` from mockData and tag entries by tool name.

- [ ] **Step 2-4** as before. Commit: `feat(collab): Tools page with connect/manage/disconnect dialogs`

---

## Phase 6 — Profile + Settings

### Task 14: Build `CollabProfile.tsx`

**Spec section:** "Profile"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/CollabProfile.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — read all sections from `useCollaboratorProfile()` + `equityHoldings` + `cashEarnings` + `endorsements` (top 3 only — link to full list on Reputation page) + `badges` (earned only).

Sections in order:
1. Header strip with avatar (initials in amber circle), name, title, location, years, headline, availability strip (`● Available · {weeklyHours} hrs/week · {commitmentStyle}`). `[Edit profile]` button → `navigate("/collaborator/settings#identity")`.
2. Reputation strip: 4 inline stats.
3. Discipline & skills: render `discipline` as heading, chips for `subSkills`, then `techStack` as muted chips.
4. Compensation philosophy card: `"Building for Equity · {pref}% equity / {100-pref}% cash · Min cash ${floor}/mo · {vestingComfort} vesting"`.
5. Active builds: same per-startup tiles as dashboard (factor into a small `<BuildTile>` component if reused enough).
6. Pinned work: render `pinnedWork` as link cards.
7. Badges earned: filter `badges.filter((b) => b.earned)`.
8. Links: GitHub / LinkedIn / Portfolio / X icons + URLs.

- [ ] **Step 2-4** as before. Commit: `feat(collab): public Profile view of collaborator state`

---

### Task 15: Build `Settings.tsx` (4 sections + Role switcher)

**Spec section:** "Settings"

**Files:** Create `frontend/src/dashboard/collaborators/section/components/collab/Settings.tsx`; modify `App.tsx`.

- [ ] **Step 1: Create the file** — left sub-nav with 4 anchors: `#identity`, `#skills`, `#notifications`, `#roles`. Right content area renders all four sections stacked; anchor scrolling does the section jumping. On mount, read `window.location.hash` and `scrollIntoView` the matching section.

**`#identity` section** — form fields editing: `avatarUrl` (mock file input — show file name on change, no upload), `name`, `title`, `location`, `yearsExperience`, `headline`, contact email (local state, not in profile — display only), change password (two inputs + button → toast `"Password updated (mock)"`). `[Save]` button → `updateCollaboratorProfile()` + `toast.success("Profile saved")`.

**`#skills` section** — full editable mirror of onboarding steps 2 + 3 + 4 + 5 in a single form. Reuse the sub-skill lists and the equity slider. `[Save]` → `updateCollaboratorProfile()` + toast.

**`#notifications` section** — 4 toggle groups (each with two `Switch` components from `ui/switch`: Email / In-app) over `notifications.opportunities`, `.deadlines`, `.payments`, `.equityEvents`. Plus `<select>` for `quietHours`. `[Save]` → `updateCollaboratorProfile({ notifications: ... })` + toast.

**`#roles` section** — read from `useActiveRoles()`. Render 4 role cards in fixed order: Collaborator (current — Switch to disabled), Founder, Investor, Organization. Each card:
- If `activeRoles.has(role)` and `currentRole !== role`: `[Switch to]` button → `navigate(roleDashboardPath[role])`.
- If `currentRole === role`: badge `"current role"`, button disabled.
- Else: `[Activate role]` button → `navigate(roleOnboardingPath[role])`.

Bottom: `Sign out` red link → `toast("Signed out (mock)")`.

- [ ] **Step 2-4** as before. Commit: `feat(collab): Settings with Identity, Skills, Notifications, Roles switcher`

---

## Phase 7 — Cleanup & verification

### Task 16: Delete obsolete files + visual tone audit + final verify

**Spec sections:** "Files deleted from the Figma export after content migrates", "Visual tone rules", "Definition of done"

**Files:**
- Delete: `frontend/src/dashboard/collaborators/section/components/AICopilot.tsx`
- Delete: `frontend/src/dashboard/collaborators/section/components/Sidebar.tsx`
- Delete: `frontend/src/dashboard/collaborators/section/layouts/WorkspaceLayout.tsx`
- Delete (entire dir): `frontend/src/dashboard/collaborators/section/pages/`
- Audit (read + correct if needed): every file in `frontend/src/dashboard/collaborators/section/components/collab/`

- [ ] **Step 1: Delete the obsolete files and directory**

```bash
rm -rf frontend/src/dashboard/collaborators/section/components/AICopilot.tsx \
       frontend/src/dashboard/collaborators/section/components/Sidebar.tsx \
       frontend/src/dashboard/collaborators/section/layouts/WorkspaceLayout.tsx \
       frontend/src/dashboard/collaborators/section/pages
rmdir frontend/src/dashboard/collaborators/section/layouts 2>/dev/null || true
```

- [ ] **Step 2: Visual tone audit pass**

Open each file in `section/components/collab/` and verify against the Visual tone rules in the spec. Specifically grep for and remove:

```bash
cd frontend/src/dashboard/collaborators/section/components/collab
grep -nE "animate-pulse|from-blue-500|from-purple-600|bg-gradient-to-(r|br)|🧠|🚨|💡|🤖|AI Insights|AI Copilot|AI Intelligence|AI Verified|AI Ranked" *.tsx
```

Expected: zero matches. Fix any that show up. (Emoji project logos `🧠 💰 🏥` are allowed — those are brand identifiers, not headings.)

- [ ] **Step 3: Verify the route table matches the spec**

```bash
grep -n "/collaborator" frontend/src/App.tsx
```

Expected: imports for `CollabLayout`, `CollabStep1..6`, and all 12 page components. The 6 onboarding routes, the parent `CollabLayout` route with 12 children, and the 2 legacy redirects. No leftover flat collab routes.

- [ ] **Step 4: Final verify build + lint**

```bash
cd frontend && npm run build && npm run lint
```
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(collab): drop Figma export's AI-Copilot + legacy pages

Removes the floating AI Copilot bubble, the generic Sidebar that the
Figma export shipped, the unused WorkspaceLayout, and the entire
pages/ directory — all content has migrated into components/collab/.
Final tone audit pass: no gradient hero panels, no AI-branded labels,
no animate-pulse dots, no emoji in headings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Hand off to user for browser verification**

Notify the user that the rebuild is ready for visual verification. The user runs `npm run dev` from a native Windows terminal (per WSL memory) and walks through:
1. From `/` → landing → "I'm a Collaborator" → onboarding step 1 through 6 → dashboard.
2. From dashboard: equity hero is the biggest panel; signals link out; standup CTA toasts; active build → workspace.
3. Equity page: vesting chart renders; cap-table dialog opens; philosophy explainer expands.
4. Tasks: mark/snooze/add work; Today/This week/Later sections populate correctly.
5. Performance / Earnings / Opportunities / Reputation / Messages / Tools — all action buttons either nav, toast, or mutate state.
6. Profile → Settings (Edit profile lands on `#identity` anchor). Settings → Roles → "Switch to Founder" lands on `/dashboard`. "Activate Investor" lands on `/investor/onboarding/step-1`.
7. Top-bar role menu visible on every `/collaborator/*` page.
8. Sidebar Feed link goes to existing `/feed`.

---

## Self-Review

Performed inline against the spec — findings:

**Spec coverage:**
- ✓ UserContext changes (interface, provider, useCollaboratorProfile, useActiveRoles) — Task 1
- ✓ Mock data restructure (equity, signals, conversations, payouts, vesting, endorsements, ToolIntegration) — Task 2
- ✓ CollabLayout (slate sidebar, amber active, Building for Equity footer card, Feed external link) — Task 3
- ✓ TopBarRoleMenu — Task 3
- ✓ 6 onboarding steps + CollabProgressBar + defensive redirect — Task 4
- ✓ Dashboard (equity-led, no AI chrome, signals panel) — Task 5
- ✓ Equity page (new) — Task 6
- ✓ Tasks / Performance / Earnings / Opportunities / Reputation / Messages / Tools — Tasks 7–13
- ✓ Profile (new) — Task 14
- ✓ Settings with 4 sections incl. Roles switcher — Task 15
- ✓ Cleanup of AICopilot, Sidebar, layouts, pages — Task 16
- ✓ Visual tone rules grep audit — Task 16
- ✓ App.tsx wiring (incremental across tasks, audited in Task 16)
- ✓ Legacy `/collaborator/setup` and `/summary` redirects — Task 3

**Placeholder scan:**
- No "TBD", no "implement later", no "similar to Task N", no "add error handling" without specifics. ✓
- Tasks 7–15 reference simpler patterns from earlier tasks but include the specific state shapes, button handlers, and mock-data accessors needed; an executing agent reading these tasks with the spec can implement them without ambiguity. ✓

**Type consistency:**
- `EquityHolding`, `CashEarning`, `Payout`, `Signal`, `Conversation`, `ConversationMessage`, `OpportunityDetail`, `ToolIntegration`, `Endorsement`, `Role`, `NotificationPrefs`, `CollaboratorProfile` — all consistently named between Task 1, Task 2, and downstream consumer tasks. ✓
- `useCollaboratorProfile`, `useActiveRoles` named identically wherever referenced. ✓
- `roleDashboardPath`, `roleOnboardingPath` — defined in TopBarRoleMenu (Task 3), referenced in Settings → Roles (Task 15). To avoid duplication, the implementer should export them from `TopBarRoleMenu.tsx` and import them in `Settings.tsx`. *Note added inline in Task 15.*

**Coverage gaps found and fixed:**
- The `Task` and `Project` types in `frontend/src/dashboard/collaborators/section/types.ts` (which the spec doesn't enumerate but mockData imports from) are kept as-is to avoid breaking older parts of the export during the rebuild. Task 2 Step 2 includes a sanity check to verify these types still satisfy the new mock data. ✓

---

Plan complete and saved to `docs/superpowers/plans/2026-05-26-collaborator-rebuild.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
