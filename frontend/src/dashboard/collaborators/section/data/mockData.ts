// frontend/src/dashboard/collaborators/section/data/mockData.ts

import type { Project, Task, Metric, Badge } from "../types";

// ────────────────────────────────────────────────────────────────
// EQUITY (the thesis)
// ────────────────────────────────────────────────────────────────

export interface CapTableRow {
  label: string;
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
  grantDate: string;
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
  monthIso: string;
  amount: number;
  status: "paid" | "processing";
}
export const payouts: Payout[] = [
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
// SIGNALS (replaces aiInsights — concrete facts only)
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
  cashCompMonthly: number;
  cashCompOneTime: number;
  equityPercent: number;
  timeCommitment: string;
  riskLevel: "low" | "medium" | "high";
  teamQuality: number;
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
  fromAvatar: string;
  quote: string;
  projectName: string;
  date: string;
}

export const endorsements: Endorsement[] = [
  { id: "e1", fromName: "Sarah Kim",   fromRole: "Designer",    fromAvatar: "SK", quote: "Alex turns specs into product faster than anyone I've worked with.",         projectName: "NeuralSync AI",   date: "2026-04-12" },
  { id: "e2", fromName: "Mike Johnson", fromRole: "Founder",    fromAvatar: "MJ", quote: "Unblocks the team. Owns outcomes. Worth every basis point.",                  projectName: "FinFlow",         date: "2026-03-28" },
  { id: "e3", fromName: "Dr. Anya Rao", fromRole: "ML Lead",    fromAvatar: "AR", quote: "Caught a subtle data leak in our pipeline that everyone else missed.",         projectName: "HealthTrack Pro", date: "2026-03-04" },
  { id: "e4", fromName: "Riya Patel",   fromRole: "PM",         fromAvatar: "RP", quote: "Pragmatic. Picks the right battles.",                                          projectName: "NeuralSync AI",   date: "2026-02-19" },
  { id: "e5", fromName: "Tomás Vega",   fromRole: "Engineer",   fromAvatar: "TV", quote: "Code reviews that make the team better.",                                       projectName: "FinFlow",         date: "2026-02-10" },
  { id: "e6", fromName: "Naomi Tanaka", fromRole: "Designer",   fromAvatar: "NT", quote: "Translates design intent into shippable code without losing the polish.",      projectName: "NeuralSync AI",   date: "2026-01-25" },
  { id: "e7", fromName: "Ben Olusola",  fromRole: "Founder",    fromAvatar: "BO", quote: "Saved our launch. Period.",                                                     projectName: "HealthTrack Pro", date: "2026-01-12" },
  { id: "e8", fromName: "Liu Chen",     fromRole: "Engineer",   fromAvatar: "LC", quote: "First person I'd hire on my next company.",                                     projectName: "FinFlow",         date: "2025-12-30" },
  { id: "e9", fromName: "Maya Iyer",    fromRole: "Founder",    fromAvatar: "MI", quote: "Equity well spent.",                                                            projectName: "NeuralSync AI",   date: "2025-12-15" },
  { id: "e10", fromName: "Dan Reyes",   fromRole: "Engineer",   fromAvatar: "DR", quote: "Made the dashboard the thing customers reference in calls.",                   projectName: "NeuralSync AI",   date: "2025-11-30" },
];

// ────────────────────────────────────────────────────────────────
// MESSAGES → CONVERSATIONS
// ────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  fromMe: boolean;
  authorName: string;
  body: string;
  timestamp: string;
}
export interface Conversation {
  id: string;
  participantName: string;
  participantAvatar: string;
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
