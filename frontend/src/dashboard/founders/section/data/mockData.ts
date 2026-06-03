// frontend/src/dashboard/founders/section/data/mockData.ts
import type { FounderStage } from "@/contexts/UserContext";

// ─── SIGNALS ───────────────────────────────────────────────
export interface Signal {
  id: string;
  type: "applications" | "investor" | "messages" | "deadline";
  message: string;
  href: string;
}
export const signals: Signal[] = [
  { id: "s1", type: "applications", message: "2 collaborator applications waiting on review", href: "/matchresults" },
  { id: "s2", type: "messages",     message: "5 unread messages",                            href: "/founder/messages" },
  { id: "s3", type: "investor",     message: "Investor Alex Chen viewed your profile · 2h ago", href: "/matchresults" },
];

// ─── TASKS ─────────────────────────────────────────────────
export interface FounderTask {
  id: string;
  title: string;
  detail: string;
  priority: "overdue" | "due-soon" | "this-week";
  href: string;
  done: boolean;
}
export const tasks: FounderTask[] = [
  { id: "t1", title: "Reply to Mike at SeedClub",        detail: "re: Series A intro · 1 day overdue", priority: "overdue",   href: "/founder/messages",           done: false },
  { id: "t2", title: "Complete pitch deck",              detail: "3 slides remaining · Due tomorrow",  priority: "due-soon",  href: "/incubation-hub", done: false },
  { id: "t3", title: "Review collaborator applications", detail: "5 pending from Find Collaborator",   priority: "this-week", href: "/matchresults",   done: false },
];

// ─── ACTIVE BUILDS ─────────────────────────────────────────
export interface Build {
  id: string;
  name: string;
  logoEmoji: string;
  stage: FounderStage;
  oneLiner: string;
  progress: number;
  isPrimary: boolean;
}
export const activeBuilds: Build[] = [
  { id: "b1", name: "AI Task Manager", logoEmoji: "🧠", stage: "MVP",  oneLiner: "AI that turns Slack chaos into a Kanban board.", progress: 65, isPrimary: true },
  { id: "b2", name: "MicroMint",       logoEmoji: "🪙", stage: "Idea", oneLiner: "Lottery savings for African gig workers.",        progress: 12, isPrimary: false },
];

// ─── RECENT ACTIVITY ───────────────────────────────────────
export interface ActivityItem {
  id: string;
  buildName: string;
  buildLogo: string;
  message: string;
  timestampISO: string;
}
export const recentActivity: ActivityItem[] = [
  { id: "ra1", buildName: "AI Task Manager", buildLogo: "🧠", message: "Mike pushed to main",           timestampISO: new Date(Date.now() -  2 * 60 * 60 * 1000).toISOString() },
  { id: "ra2", buildName: "AI Task Manager", buildLogo: "🧠", message: "Sarah opened PR #88",           timestampISO: new Date(Date.now() -  4 * 60 * 60 * 1000).toISOString() },
  { id: "ra3", buildName: "AI Task Manager", buildLogo: "🧠", message: "Daily standup logged",          timestampISO: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
  { id: "ra4", buildName: "MicroMint",       buildLogo: "🪙", message: "Idea validated by 3 reviewers", timestampISO: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString() },
];

// ─── JOURNEY ───────────────────────────────────────────────
export interface JourneyStage {
  id: string;
  label: string;
  status: "complete" | "active" | "upcoming";
  progress: number;
  detail: string;
}
export const journey: JourneyStage[] = [
  { id: "idea",   label: "Idea Validated",  status: "complete", progress: 100, detail: "Customer interviews + market sizing done." },
  { id: "team",   label: "Team Building",   status: "active",   progress:  65, detail: "2 of 5 roles filled. Frontend + ML still open." },
  { id: "mvp",    label: "MVP Development", status: "active",   progress:  32, detail: "Sprint 3 of 8. Slack integration in progress." },
  { id: "market", label: "Market Testing",  status: "upcoming", progress:   0, detail: "Locked until MVP reaches 70% completion." },
  { id: "launch", label: "Launch Ready",    status: "upcoming", progress:   0, detail: "Locked until Market Testing kicks off." },
];

// ─── ENDORSEMENTS ──────────────────────────────────────────
export interface Endorsement {
  id: string;
  fromName: string;
  fromRole: string;
  fromAvatar: string;
  quote: string;
  buildName: string;
  date: string;
}
export const endorsements: Endorsement[] = [
  { id: "e1", fromName: "Mike Ross",  fromRole: "ML Engineer", fromAvatar: "MR", quote: "Sarah ships ideas faster than anyone I've worked with. Trusted her with the model architecture and never regretted it.", buildName: "AI Task Manager", date: "2026-04-12" },
  { id: "e2", fromName: "Tomás Vega", fromRole: "Designer",    fromAvatar: "TV", quote: "Decisive. Knows what the product needs to be, but listens.",                                                                buildName: "AI Task Manager", date: "2026-03-28" },
  { id: "e3", fromName: "Riya Patel", fromRole: "PM",          fromAvatar: "RP", quote: "Pragmatic. Picks the right battles. Makes founders look easy when they're not.",                                          buildName: "AI Task Manager", date: "2026-03-04" },
];
