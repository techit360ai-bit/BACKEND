# Founders Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Founder role to parity with Collaborator/Investor/Org — a FounderLayout shell, 6-step onboarding wizard, restructured dashboard, Profile page, and Settings page with role switching + identity verification — while deleting the dead `home.tsx` and global `Sidebar.tsx`.

**Architecture:** All founder code lives under `frontend/src/dashboard/founders/` in two siblings: `onboarding/` (6-step wizard) and `section/components/founder/` (layout + pages). Pages render inside `<FounderLayout/>` in `App.tsx` (matching Org/Investor/Collaborator). State lives in `UserContext` (`founderProfile` + `useFounderProfile` + updated `useActiveRoles`). Two shared utilities (`roleRoutes`, `formatRelative`) get deduped into `frontend/src/lib/`.

**Tech Stack:** React 19, react-router-dom, TypeScript, Tailwind, lucide-react, sonner (toasts), recharts (already present), shadcn/ui primitives (reuse Collaborator's under `collaborators/section/components/ui/` — see Task 4 note on import source).

**Spec:** [`docs/superpowers/specs/2026-05-28-founders-foundation-design.md`](../specs/2026-05-28-founders-foundation-design.md). Read the relevant spec section before each task.

**Verification gate:** Every task ends with `tsc --noEmit` run from `frontend/` via the Windows node binary (npm's `build` script can't run from WSL — UNC path limitation):
```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```
**Baseline at branch cut (`4e5190f`): 33 errors.** All pre-existing, in `workspaces/`, `founderSummary`, `chat/`, `Login.tsx`, `SidebarContext.tsx`. No task may increase this count in files it touches. By end of plan, the count should DROP (deleting `home.tsx` removes some). No test framework exists — verification is `tsc` + the user's manual browser pass at the end (run from a native Windows terminal; `npm run dev` doesn't work from WSL).

**Branch:** `feature/founders-foundation` (already cut from `4ca1016`, currently at `4e5190f` after the spec commit). Do NOT switch branches.

**Reference files to read before starting:**
- `frontend/src/contexts/UserContext.tsx` — the `collaboratorProfile` + `useActiveRoles` pattern to mirror
- `frontend/src/dashboard/collaborators/section/components/collab/CollabLayout.tsx` — sidebar/topbar pattern
- `frontend/src/dashboard/collaborators/section/components/collab/TopBarRoleMenu.tsx` — role menu pattern
- `frontend/src/dashboard/collaborators/onboarding/CollabStep1.tsx` + `CollabStep5.tsx` — wizard shell pattern
- `frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx` — dashboard pattern + `formatRelative`
- `frontend/src/dashboard/collaborators/section/components/collab/Settings.tsx` — 4-section settings pattern
- `frontend/src/App.tsx` — current route shape

---

## Phase 1 — Foundation

### Task 1: Extract shared `roleRoutes` + `formatRelative` into `@/lib`

**Spec section:** "Shared modules"

**Files:**
- Create: `frontend/src/lib/roleRoutes.ts`
- Create: `frontend/src/lib/formatRelative.ts`
- Modify: `frontend/src/dashboard/collaborators/section/components/collab/TopBarRoleMenu.tsx`
- Modify: `frontend/src/dashboard/collaborators/section/components/collab/Settings.tsx`
- Modify: `frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx`
- Delete: `frontend/src/dashboard/collaborators/section/components/collab/roleRoutes.ts`

- [ ] **Step 1: Create `frontend/src/lib/roleRoutes.ts`**

Note the founder onboarding path is updated to the NEW wizard route (`/founder/onboarding/step-1`), not the old `/founder/setup`:

```ts
// frontend/src/lib/roleRoutes.ts
import type { Role } from "@/contexts/UserContext";

export const roleDashboardPath: Record<Role, string> = {
  founder: "/dashboard",
  collaborator: "/collaborator/dashboard",
  investor: "/investor/dashboard",
  org: "/org/dashboard",
};

export const roleOnboardingPath: Record<Role, string> = {
  founder: "/founder/onboarding/step-1",
  collaborator: "/collaborator/onboarding/step-1",
  investor: "/investor/onboarding/step-1",
  org: "/org/onboarding/step-1",
};
```

- [ ] **Step 2: Create `frontend/src/lib/formatRelative.ts`**

Copy the exact function body currently in `collaborators/.../Dashboard.tsx` lines 13-20:

```ts
// frontend/src/lib/formatRelative.ts
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
```

- [ ] **Step 3: Update Collaborator `TopBarRoleMenu.tsx` import**

Find the line `import { roleDashboardPath, roleOnboardingPath } from "./roleRoutes";` and change it to:

```tsx
import { roleDashboardPath, roleOnboardingPath } from "@/lib/roleRoutes";
```

- [ ] **Step 4: Update Collaborator `Settings.tsx` import**

Find `import { roleDashboardPath, roleOnboardingPath } from "./roleRoutes";` and change it to:

```tsx
import { roleDashboardPath, roleOnboardingPath } from "@/lib/roleRoutes";
```

- [ ] **Step 5: Update Collaborator `Dashboard.tsx` to import `formatRelative`**

Remove the local `function formatRelative(...) { ... }` definition (lines ~13-20). Add at the top of the imports:

```tsx
import { formatRelative } from "@/lib/formatRelative";
```

Verify no other local references to a now-deleted helper remain.

- [ ] **Step 6: Delete the old Collaborator `roleRoutes.ts`**

```bash
cd /home/faithsax/techIT
rm frontend/src/dashboard/collaborators/section/components/collab/roleRoutes.ts
```

- [ ] **Step 7: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -E "(roleRoutes|formatRelative|TopBarRoleMenu|collab/Settings|collab/Dashboard)"
```
Expected: zero matches. Global count check:
```bash
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```
Expected: 33 (unchanged).

- [ ] **Step 8: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/lib/roleRoutes.ts frontend/src/lib/formatRelative.ts \
        frontend/src/dashboard/collaborators/section/components/collab/TopBarRoleMenu.tsx \
        frontend/src/dashboard/collaborators/section/components/collab/Settings.tsx \
        frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx \
        frontend/src/dashboard/collaborators/section/components/collab/roleRoutes.ts
git commit -m "$(cat <<'EOF'
refactor(lib): extract roleRoutes + formatRelative into @/lib

Dedupes the role-path maps and the relative-time helper out of the
Collaborator section so the upcoming Founder section can share them.
Updates the founder onboarding path to /founder/onboarding/step-1
ahead of the wizard rebuild.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extend `UserContext.tsx` with `FounderProfile`

**Spec section:** "UserContext changes"

**Files:**
- Modify: `frontend/src/contexts/UserContext.tsx`

- [ ] **Step 1: Add the founder types and interfaces (place near the `CollaboratorProfile` block)**

```ts
export type FounderStage = "Idea" | "MVP" | "Beta" | "Launch" | "Growth";
export type FounderExperience = "first-time" | "some-experience" | "serial";
export type LaunchStatus = "pre-launch" | "private-beta" | "public";
export type CompModel = "equity-heavy" | "cash-equity-mix" | "cash-heavy";
export type OwnershipPhilosophy = "equity-day-one" | "cash-first-equity-later" | "custom";
export type OpenRole =
  | "Frontend Engineer" | "Backend Engineer" | "Full-stack Engineer"
  | "ML Engineer" | "Designer (Product)" | "Designer (Visual)"
  | "Product Manager" | "Data Scientist" | "DevOps Engineer"
  | "Growth Marketer" | "Content / Copy" | "Founder Associate";

export interface FounderVerification {
  twitter:      { handle: string;   verified: boolean };
  linkedin:     { url: string;      verified: boolean };
  personalSite: { url: string;      verified: boolean };
  github:       { username: string; verified: boolean };
  nin: {
    country: string;
    docType: "nin" | "passport" | "driver-license";
    docNumber: string;
    status: "unverified" | "pending" | "verified";
  };
}

export interface FounderNotificationPrefs {
  applications:  { email: boolean; inApp: boolean };
  investors:     { email: boolean; inApp: boolean };
  workspace:     { email: boolean; inApp: boolean };
  opportunities: { email: boolean; inApp: boolean };
  quietHours:    "off" | "10pm-8am" | "weekends";
}

export interface FounderProfile {
  // Step 1
  name: string;
  title: string;
  location: string;
  yearsBuilding: number;
  founderType: FounderExperience;
  headline: string;
  avatarUrl: string;
  // Step 2
  startupName: string;
  oneLiner: string;
  stage: FounderStage;
  industries: string[];
  foundingYear: number;
  website: string;
  logoEmoji: string;
  // Step 3
  currentTeamSize: number;
  openRoles: OpenRole[];
  compensationOffered: CompModel;
  equityRangeMin: number;
  equityRangeMax: number;
  // Step 4
  launchStatus: LaunchStatus;
  users: number;
  revenueMonthly: number;
  fundingRaised: number;
  leadInvestor: string;
  nextMilestone: string;
  // Step 5
  whyBuilding: string;
  winningIn3Years: string;
  unfairAdvantage: string;
  ownershipPhilosophy: OwnershipPhilosophy;
  // Step 6
  links: { github: string; linkedin: string; twitter: string; personal: string };
  needsFromTechIT: string[];
  pinnedWork: string[];
  // Status
  onboardingComplete: boolean;
  verification: FounderVerification;
  notifications: FounderNotificationPrefs;
}
```

- [ ] **Step 2: Add `founderProfile` + `updateFounderProfile` to `UserContextType`**

In the `UserContextType` interface, add:

```ts
founderProfile: FounderProfile;
updateFounderProfile: (updates: Partial<FounderProfile>) => void;
```

- [ ] **Step 3: Add provider state for `founderProfile`**

Inside `UserProvider`, alongside the other profile states, add the seed:

```ts
const [founderProfile, setFounderProfile] = useState<FounderProfile>({
  name: "Sarah Chen",
  title: "Founder & CEO",
  location: "Lagos, Nigeria",
  yearsBuilding: 5,
  founderType: "first-time",
  headline: "Building the operating system for African SMEs.",
  avatarUrl: "",
  startupName: "AI Task Manager",
  oneLiner: "AI that turns Slack chaos into a Kanban board.",
  stage: "MVP",
  industries: ["AI/ML", "SaaS"],
  foundingYear: 2026,
  website: "techit.ai",
  logoEmoji: "🧠",
  currentTeamSize: 2,
  openRoles: ["Frontend Engineer", "ML Engineer", "Designer (Product)"],
  compensationOffered: "equity-heavy",
  equityRangeMin: 0.5,
  equityRangeMax: 2.5,
  launchStatus: "private-beta",
  users: 240,
  revenueMonthly: 0,
  fundingRaised: 0,
  leadInvestor: "",
  nextMilestone: "Hit 1,000 active users by August.",
  whyBuilding: "I watched my mother's bakery drown in WhatsApp orders. There's nothing built for African SMEs that talks the way they actually work.",
  winningIn3Years: "Default SaaS for any African SME under 50 employees. $10M ARR.",
  unfairAdvantage: "I ran SME ops for 4 years. I know the broken workflows by name.",
  ownershipPhilosophy: "equity-day-one",
  links: {
    github: "github.com/sarahchen",
    linkedin: "linkedin.com/in/sarahchen",
    twitter: "@sarahchen",
    personal: "sarahchen.com",
  },
  needsFromTechIT: ["Find collaborators", "Customer interviews"],
  pinnedWork: [],
  onboardingComplete: true,
  verification: {
    twitter:      { handle: "@sarahchen", verified: false },
    linkedin:     { url: "linkedin.com/in/sarahchen", verified: true },
    personalSite: { url: "sarahchen.com", verified: false },
    github:       { username: "sarahchen", verified: true },
    nin: { country: "Nigeria", docType: "nin", docNumber: "", status: "unverified" },
  },
  notifications: {
    applications:  { email: true, inApp: true },
    investors:     { email: true, inApp: true },
    workspace:     { email: false, inApp: true },
    opportunities: { email: true, inApp: true },
    quietHours:    "off",
  },
});

/**
 * Shallow merge — for nested fields like `verification`, `notifications`, or `links`,
 * callers must spread the existing sub-object themselves,
 * e.g. updateFounderProfile({ notifications: { ...prev.notifications, quietHours: "weekends" } }).
 */
const updateFounderProfile = (updates: Partial<FounderProfile>) => {
  setFounderProfile((prev) => ({ ...prev, ...updates }));
};
```

- [ ] **Step 4: Wire into the context value**

Add `founderProfile` and `updateFounderProfile` to the `<UserContext.Provider value={{ ... }}>` object alongside the existing entries.

- [ ] **Step 5: Update `useActiveRoles` founder derivation**

Find the line in `useActiveRoles` that adds `"founder"` to `activeRoles` unconditionally (currently `new Set<Role>(["founder"])` or similar). Change the memo so founder is derived from `onboardingComplete`. The `useMemo` becomes:

```ts
const activeRoles = useMemo(() => {
  const s = new Set<Role>();
  if (founderProfile.onboardingComplete)              s.add("founder");
  if (collaboratorProfile.onboardingComplete)         s.add("collaborator");
  if (investorProfile.industries.length > 0)          s.add("investor");
  if (orgProfile.verificationStatus !== "unverified") s.add("org");
  return s;
}, [founderProfile.onboardingComplete, collaboratorProfile.onboardingComplete, investorProfile.industries.length, orgProfile.verificationStatus]);
```

Make sure `founderProfile` is destructured from `useUser()` at the top of `useActiveRoles` alongside the other profiles. The `currentRole` derivation stays as-is but verify it maps `/dashboard`, `/incubation-hub`, `/chat`, `/matchresults`, and `/founder/*` to `"founder"`:

```ts
let currentRole: Role = "founder";
if (path.startsWith("/collaborator")) currentRole = "collaborator";
else if (path.startsWith("/investor")) currentRole = "investor";
else if (path.startsWith("/org"))      currentRole = "org";
// everything else (/dashboard, /incubation-hub, /chat, /matchresults, /founder/*) → founder
```

- [ ] **Step 6: Add `useFounderProfile` hook at the bottom of the file**

```ts
export function useFounderProfile() {
  const { founderProfile, updateFounderProfile } = useUser();
  return { founderProfile, updateFounderProfile };
}
```

- [ ] **Step 7: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -i "usercontext"
```
Expected: zero matches. Global count ≤ 33.

- [ ] **Step 8: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/contexts/UserContext.tsx
git commit -m "$(cat <<'EOF'
feat(context): add FounderProfile + useFounderProfile

Adds the typed FounderProfile (identity, startup, team/roles, traction,
mission, links, verification, notifications), provider state with seed
data, useFounderProfile hook, and switches useActiveRoles to derive the
founder role from onboardingComplete instead of the always-active
carve-out.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create founder `mockData.ts`

**Spec section:** "Mock data"

**Files:**
- Create: `frontend/src/dashboard/founders/section/data/mockData.ts`

- [ ] **Step 1: Create the file with this exact content**

```ts
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
  { id: "s2", type: "messages",     message: "5 unread messages",                            href: "/chat" },
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
  { id: "t1", title: "Reply to Mike at SeedClub",        detail: "re: Series A intro · 1 day overdue", priority: "overdue",   href: "/chat",           done: false },
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
```

- [ ] **Step 2: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -i "founders/section/data"
```
Expected: zero matches.

- [ ] **Step 3: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/data/mockData.ts
git commit -m "feat(founder): founder dashboard mock data

Signals, tasks, active builds, recent activity, 5-stage journey, and
endorsements. Timestamps computed relative to Date.now() so they age
gracefully. Mirrors the Collaborator mock data shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Layout shell

### Task 4: Create `FounderLayout` + `TopBarRoleMenu` + base route

**Spec sections:** "FounderLayout", "App.tsx final shape"

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/founder/TopBarRoleMenu.tsx`
- Create: `frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx`
- Modify: `frontend/src/App.tsx`

**UI primitive source note:** Founder pages reuse the shadcn primitives already vendored under `frontend/src/dashboard/collaborators/section/components/ui/` (Dialog, Sheet, etc.) and the sonner `Toaster` there. Import them with the full path, e.g. `import { Toaster } from "@/dashboard/collaborators/section/components/ui/sonner";`. Do NOT duplicate the ui/ directory.

- [ ] **Step 1: Create `TopBarRoleMenu.tsx`**

```tsx
// frontend/src/dashboard/founders/section/components/founder/TopBarRoleMenu.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, UserCircle, Settings as SettingsIcon, LogOut, Check } from "lucide-react";
import { toast } from "sonner";
import { useUser, useActiveRoles, type Role } from "@/contexts/UserContext";
import { roleDashboardPath, roleOnboardingPath } from "@/lib/roleRoutes";

const roleLabel: Record<Role, string> = {
  founder: "Founder",
  collaborator: "Collaborator",
  investor: "Investor",
  org: "Organization",
};

export function TopBarRoleMenu() {
  const navigate = useNavigate();
  const { founderProfile } = useUser();
  const { activeRoles, currentRole } = useActiveRoles();
  const [open, setOpen] = useState(false);

  const initials = founderProfile.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  const handleRoleClick = (role: Role) => {
    setOpen(false);
    if (activeRoles.has(role)) navigate(roleDashboardPath[role]);
    else                       navigate(roleOnboardingPath[role]);
  };

  const handleLogout = () => { setOpen(false); toast("Signed out (mock)"); };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
        <div className="w-8 h-8 rounded-full bg-violet-600 text-white font-semibold flex items-center justify-center text-sm tabular-nums">{initials}</div>
        <div className="text-left hidden md:block">
          <div className="text-sm font-medium text-slate-900">{founderProfile.name}</div>
          <div className="text-xs text-slate-500">Founder · Building {founderProfile.startupName}</div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">{founderProfile.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">Founder · Building {founderProfile.startupName}</div>
            </div>

            <button type="button" onClick={() => { setOpen(false); navigate("/founder/profile"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <UserCircle className="w-4 h-4" /> View profile
            </button>
            <button type="button" onClick={() => { setOpen(false); navigate("/founder/settings"); }}
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
                <button key={role} type="button" onClick={() => handleRoleClick(role)} disabled={isCurrent}
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

- [ ] **Step 2: Create `FounderLayout.tsx`**

```tsx
// frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx
import { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FlaskConical, PanelsTopLeft, Rss, Sparkles, Lightbulb,
  Route as RouteIcon, MessageSquare, LineChart, Wallet, UserCircle,
  Settings as SettingsIcon, ArrowLeft,
} from "lucide-react";
import { Toaster } from "@/dashboard/collaborators/section/components/ui/sonner";
import { useFounderProfile } from "@/contexts/UserContext";
import { TopBarRoleMenu } from "./TopBarRoleMenu";

type NavKind = "link" | "external" | "placeholder";
interface NavItem { name: string; path: string; icon: typeof LayoutDashboard; kind: NavKind; }

const primaryNav: NavItem[] = [
  { name: "Dashboard",      path: "/dashboard",      icon: LayoutDashboard, kind: "link" },
  { name: "Incubation Hub", path: "/incubation-hub", icon: FlaskConical,    kind: "link" },
  { name: "Workspaces",     path: "/workspaces",     icon: PanelsTopLeft,   kind: "link" },
  { name: "Feed",           path: "/feed",           icon: Rss,             kind: "external" },
];

const comingSoonNav: NavItem[] = [
  { name: "Opportunity Hub", path: "#", icon: Sparkles,  kind: "placeholder" },
  { name: "Idea Hub",        path: "#", icon: Lightbulb, kind: "placeholder" },
  { name: "Market Pathway",  path: "#", icon: RouteIcon, kind: "placeholder" },
];

const utilityNav: NavItem[] = [
  { name: "Messages",  path: "/chat",        icon: MessageSquare, kind: "link" },
  { name: "Investors", path: "/matchresults", icon: LineChart,    kind: "link" },
  { name: "Wallet",    path: "/wallet",      icon: Wallet,        kind: "external" },
];

const accountNav: NavItem[] = [
  { name: "Profile",  path: "/founder/profile",  icon: UserCircle,   kind: "link" },
  { name: "Settings", path: "/founder/settings", icon: SettingsIcon, kind: "link" },
];

export function FounderLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { founderProfile } = useFounderProfile();

  useEffect(() => {
    if (!founderProfile.onboardingComplete && !location.pathname.startsWith("/founder/onboarding")) {
      navigate("/founder/onboarding/step-1", { replace: true });
    }
  }, [founderProfile.onboardingComplete, location.pathname, navigate]);

  const isActive = (path: string) => location.pathname === path;
  const initials = founderProfile.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    if (item.kind === "placeholder") {
      return (
        <span key={item.name}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-slate-400 cursor-default">
          <Icon className="w-4 h-4" />
          <span className="flex-1 font-medium">{item.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono uppercase tracking-wider">Soon</span>
        </span>
      );
    }
    const active = isActive(item.path);
    return (
      <Link key={item.path} to={item.path}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
          active
            ? "bg-violet-50 text-violet-700 border-l-2 border-violet-600"
            : "text-slate-700 hover:bg-slate-50"
        }`}>
        <Icon className="w-4 h-4" />
        <span className="flex-1 font-medium">{item.name}</span>
        {item.kind === "external" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono uppercase tracking-wider">Hub</span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-200">
        <div className="p-5 border-b border-slate-200">
          <Link to="/" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 transition-colors mb-3">
            <ArrowLeft className="w-3 h-3" /> Back to TechIT
          </Link>
          <h1 className="text-xl font-bold text-violet-600 tracking-wide">TECHIT</h1>
          <p className="text-xs text-slate-500 mt-0.5">Founder Portal</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {primaryNav.map(renderItem)}
          <div className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Coming soon</div>
          {comingSoonNav.map(renderItem)}
          <div className="h-px bg-slate-100 my-3" />
          {utilityNav.map(renderItem)}
          <div className="h-px bg-slate-100 my-3" />
          {accountNav.map(renderItem)}
        </nav>

        <Link to="/founder/profile" className="m-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-600 text-white text-sm font-semibold flex items-center justify-center">{initials}</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{founderProfile.name}</p>
            <p className="text-xs text-slate-500 truncate">Founder · {founderProfile.startupName} · {founderProfile.stage}</p>
          </div>
        </Link>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="text-sm text-slate-500">
            {[...primaryNav, ...utilityNav, ...accountNav].find((n) => isActive(n.path))?.name ?? ""}
          </div>
          <TopBarRoleMenu />
        </header>
        <div className="flex-1 overflow-y-auto"><Outlet /></div>
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
```

- [ ] **Step 3: Wire the layout into `App.tsx` (initial — just the parent route + redirects)**

Add import near the other layout imports:
```tsx
import { FounderLayout } from "@/dashboard/founders/section/components/founder/FounderLayout";
```

Do NOT yet remove the existing `/dashboard`, `/incubation-hub`, `/chat`, `/matchresults` routes — those get migrated in Tasks 6 and 9. For now, just add the legacy redirects so the new onboarding path is reachable:
```tsx
<Route path="/founder/setup"   element={<Navigate to="/founder/onboarding/step-1" replace />} />
<Route path="/founder/summary" element={<Navigate to="/dashboard" replace />} />
```
(If `/founder/setup` / `/founder/summary` routes already exist pointing at `FounderSetup`/`FounderSummary`, leave them for now — Task 10 deletes those components and this redirect replaces them. To avoid a duplicate-route conflict in this task, only add these redirects if the old routes are NOT present. If they ARE present, skip this step — Task 10 handles it.)

- [ ] **Step 4: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -E "(FounderLayout|founder/TopBarRoleMenu|App\.tsx)"
```
Expected: zero matches. Global count ≤ 33.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx \
        frontend/src/dashboard/founders/section/components/founder/TopBarRoleMenu.tsx \
        frontend/src/App.tsx
git commit -m "feat(founder): FounderLayout shell with white sidebar + violet accent

White sidebar (violet-600 active), top-bar TopBarRoleMenu, defensive
onboarding redirect, footer profile card reading real founderProfile
(no Demo User). Sidebar has 3 disabled Soon placeholders (Opportunity
Hub / Idea Hub / Market Pathway), Feed + Wallet as external Hub links,
Messages → /chat, Investors → /matchresults.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Onboarding wizard

### Task 5: `FounderProgressBar` + 6 step pages + routes

**Spec section:** "Onboarding wizard (6 steps)"

**Files:**
- Create: `frontend/src/dashboard/founders/onboarding/FounderProgressBar.tsx`
- Create: `frontend/src/dashboard/founders/onboarding/FounderStep1.tsx` … `FounderStep6.tsx`
- Modify: `frontend/src/App.tsx`

**Pattern:** Read `frontend/src/dashboard/collaborators/onboarding/CollabStep1.tsx` (shell + `Field` helper) and `CollabStep5.tsx` (slider + radio cards) first. Reuse the same shell structure; swap amber for violet (`focus:border-violet-500`, `bg-violet-500`→`bg-violet-600` for primary buttons, `text-violet-600` for accents). `Save & exit` navigates to `/` not `/dashboard` (founders without onboarding have no dashboard).

- [ ] **Step 1: Create `FounderProgressBar.tsx`** (violet accent)

```tsx
// frontend/src/dashboard/founders/onboarding/FounderProgressBar.tsx
interface Props { currentStep: number; totalSteps: number; }
export function FounderProgressBar({ currentStep, totalSteps }: Props) {
  const progress = (currentStep / totalSteps) * 100;
  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-500">Step {currentStep} of {totalSteps}</span>
        <span className="text-sm text-violet-600 font-semibold">{Math.round(progress)}% Complete</span>
      </div>
      <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-violet-600 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `FounderStep1.tsx` (Identity)**

Mirror `CollabStep1.tsx`'s shell exactly (the `Field` helper at the bottom, the `Save & exit` top-right, the `min-h-screen bg-slate-50` wrapper, the violet `Continue →` button). Fields and state:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFounderProfile, type FounderExperience } from "@/contexts/UserContext";
import { FounderProgressBar } from "./FounderProgressBar";
import { User, MapPin, Briefcase, Calendar, MessageSquare } from "lucide-react";

export function FounderStep1() {
  const navigate = useNavigate();
  const { founderProfile, updateFounderProfile } = useFounderProfile();
  const [name, setName]         = useState(founderProfile.name);
  const [title, setTitle]       = useState(founderProfile.title);
  const [location, setLocation] = useState(founderProfile.location);
  const [years, setYears]       = useState(founderProfile.yearsBuilding);
  const [type, setType]         = useState<FounderExperience>(founderProfile.founderType);
  const [headline, setHeadline] = useState(founderProfile.headline);

  const canContinue = name.trim() && title.trim() && location.trim() && years >= 0 && headline.trim();
  const persist = () => updateFounderProfile({ name, title, location, yearsBuilding: years, founderType: type, headline });
  const handleNext = () => { persist(); navigate("/founder/onboarding/step-2"); };
  const handleSaveExit = () => { persist(); navigate("/"); };

  // ... render: progress bar (currentStep={1} totalSteps={6}), heading "Tell us who you are",
  // Field("Full name", User), Field("Professional title", Briefcase), Field("Location", MapPin),
  // Field("Years building", Calendar, number input),
  // a "Founder type" 3-button radio group (first-time / some-experience / serial) styled like
  //   CollabStep2's discipline buttons (violet selected state),
  // Field("Headline (one line)", MessageSquare, maxLength 120),
  // footer: only "Continue →" (no Back on step 1), disabled when !canContinue.
}
```

Render the founder-type radio group with these three options mapping to the literal values: `{ v: "first-time", label: "First time" }`, `{ v: "some-experience", label: "Some experience" }`, `{ v: "serial", label: "Serial" }`. Selected state: `border-violet-500 bg-violet-50 text-violet-700`.

- [ ] **Step 3: Create `FounderStep2.tsx` (Startup snapshot)**

Shell same as Step 1 (include Back → step-1). State + fields:

```tsx
const [startupName, setStartupName] = useState(founderProfile.startupName);
const [oneLiner, setOneLiner]       = useState(founderProfile.oneLiner);
const [stage, setStage]             = useState(founderProfile.stage);          // radio: Idea/MVP/Beta/Launch/Growth
const [industries, setIndustries]   = useState<string[]>(founderProfile.industries); // chip multi, 1–3
const [foundingYear, setFoundingYear] = useState(founderProfile.foundingYear);
const [website, setWebsite]         = useState(founderProfile.website);
const [logoEmoji, setLogoEmoji]     = useState(founderProfile.logoEmoji);
const canContinue = startupName.trim() && oneLiner.trim() && stage && industries.length >= 1 && industries.length <= 3;
```

Industry options (chip grid): `["AI/ML", "SaaS", "FinTech", "HealthTech", "E-Commerce", "Edtech", "CleanTech", "Web3"]`. Stage options (radio cards): `["Idea", "MVP", "Beta", "Launch", "Growth"]`. Persist `{ startupName, oneLiner, stage, industries, foundingYear, website, logoEmoji }` → step-3.

- [ ] **Step 4: Create `FounderStep3.tsx` (Team & roles)**

Shell same. State + fields:

```tsx
const [teamSize, setTeamSize]   = useState(founderProfile.currentTeamSize);
const [roles, setRoles]         = useState<OpenRole[]>(founderProfile.openRoles); // max 5
const [comp, setComp]           = useState(founderProfile.compensationOffered);   // radio
const [eqMin, setEqMin]         = useState(founderProfile.equityRangeMin);
const [eqMax, setEqMax]         = useState(founderProfile.equityRangeMax);
const canContinue = teamSize >= 1 && roles.length >= 1 && roles.length <= 5 && eqMax >= eqMin;
```

Import `type OpenRole` from `@/contexts/UserContext`. The 12 role chips:
```ts
const ALL_ROLES: OpenRole[] = [
  "Frontend Engineer", "Backend Engineer", "Full-stack Engineer",
  "ML Engineer", "Designer (Product)", "Designer (Visual)",
  "Product Manager", "Data Scientist", "DevOps Engineer",
  "Growth Marketer", "Content / Copy", "Founder Associate",
];
```
Compensation radio: `{ v: "equity-heavy", label: "Equity-heavy" }`, `{ v: "cash-equity-mix", label: "Cash + equity" }`, `{ v: "cash-heavy", label: "Cash-heavy" }`. Equity range: two number inputs (`eqMin`, `eqMax`, step 0.1, suffix %). Persist `{ currentTeamSize: teamSize, openRoles: roles, compensationOffered: comp, equityRangeMin: eqMin, equityRangeMax: eqMax }` → step-4. Back → step-2.

- [ ] **Step 5: Create `FounderStep4.tsx` (Traction & metrics)**

Shell same. State + fields:

```tsx
const [launch, setLaunch]       = useState(founderProfile.launchStatus);   // radio: pre-launch/private-beta/public
const [users, setUsers]         = useState(founderProfile.users);
const [revenue, setRevenue]     = useState(founderProfile.revenueMonthly);
const [funding, setFunding]     = useState(founderProfile.fundingRaised);
const [investor, setInvestor]   = useState(founderProfile.leadInvestor);
const [milestone, setMilestone] = useState(founderProfile.nextMilestone);
const canContinue = milestone.trim().length > 0;  // everything else can be 0/empty
```

Launch radio: `{ v: "pre-launch", label: "Pre-launch" }`, `{ v: "private-beta", label: "Private beta" }`, `{ v: "public", label: "Public" }`. `users`/`revenue`/`funding` number inputs (default 0). `investor` optional text. `milestone` one-line text. Persist `{ launchStatus: launch, users, revenueMonthly: revenue, fundingRaised: funding, leadInvestor: investor, nextMilestone: milestone }` → step-5. Back → step-3.

- [ ] **Step 6: Create `FounderStep5.tsx` (Mission)**

Shell same, with the mission intro paragraph. State + fields:

```tsx
const [why, setWhy]           = useState(founderProfile.whyBuilding);
const [winning, setWinning]   = useState(founderProfile.winningIn3Years);
const [advantage, setAdvantage] = useState(founderProfile.unfairAdvantage);
const [philosophy, setPhilosophy] = useState(founderProfile.ownershipPhilosophy);
const canContinue = why.trim() && winning.trim() && advantage.trim();
```

Intro paragraph (above the fields):
> "TechIT is built on the belief that founders should ship outcomes, not pitch decks. The collaborators you bring in earn equity, not just a paycheck. Tell us what you're aiming at."

Three textareas (`why`, `winning`, `advantage`) + ownership philosophy radio cards: `{ v: "equity-day-one", label: "Collaborators earn equity from day one" }`, `{ v: "cash-first-equity-later", label: "Cash-first now, equity at seed" }`, `{ v: "custom", label: "Custom (negotiate per-person)" }`. Persist `{ whyBuilding: why, winningIn3Years: winning, unfairAdvantage: advantage, ownershipPhilosophy: philosophy }` → step-6. Back → step-4. Add the grey verification banner near the bottom: `"Verify your GitHub / socials / ID in Settings → Verification after you finish. Verified founders see more matches."`

- [ ] **Step 7: Create `FounderStep6.tsx` (Goals & links — final)**

Shell same, but Continue is labeled `Finish →` and finalizes. State + fields:

```tsx
import { toast } from "sonner";
const [github, setGithub]       = useState(founderProfile.links.github);
const [linkedin, setLinkedin]   = useState(founderProfile.links.linkedin);
const [twitter, setTwitter]     = useState(founderProfile.links.twitter);
const [personal, setPersonal]   = useState(founderProfile.links.personal);
const [needs, setNeeds]         = useState<string[]>(founderProfile.needsFromTechIT); // max 3
const [pinned, setPinned]       = useState<string[]>(founderProfile.pinnedWork);      // up to 3

const handleFinish = () => {
  updateFounderProfile({
    links: { github, linkedin, twitter, personal },
    needsFromTechIT: needs,
    pinnedWork: pinned.filter((u) => u.trim()),
    onboardingComplete: true,
  });
  toast.success(`You're in. Welcome to TechIT, ${founderProfile.name.split(" ")[0]}.`);
  navigate("/dashboard");
};
```

Four URL inputs (all optional). Needs chip multi-select (max 3) from: `["Find collaborators", "Find investors", "Validate the idea", "Build the MVP faster", "Customer interviews", "Pricing experiments", "Hire first sales hire", "Hackathon momentum", "Mentorship", "Just exploring"]`. Pinned work: dynamic list of up to 3 URL inputs with add/remove. Back → step-5. The same verification banner as Step 5. `canContinue` is always true.

- [ ] **Step 8: Wire onboarding routes in App.tsx**

Add imports:
```tsx
import { FounderStep1 } from "@/dashboard/founders/onboarding/FounderStep1";
import { FounderStep2 } from "@/dashboard/founders/onboarding/FounderStep2";
import { FounderStep3 } from "@/dashboard/founders/onboarding/FounderStep3";
import { FounderStep4 } from "@/dashboard/founders/onboarding/FounderStep4";
import { FounderStep5 } from "@/dashboard/founders/onboarding/FounderStep5";
import { FounderStep6 } from "@/dashboard/founders/onboarding/FounderStep6";
```

Add routes (NOT inside FounderLayout — onboarding has no sidebar). Replace the existing `/founder/setup` and `/founder/summary` routes (which currently render `FounderSetup`/`FounderSummary`) with the 6 step routes + the 2 legacy redirects:
```tsx
<Route path="/founder/onboarding/step-1" element={<FounderStep1 />} />
<Route path="/founder/onboarding/step-2" element={<FounderStep2 />} />
<Route path="/founder/onboarding/step-3" element={<FounderStep3 />} />
<Route path="/founder/onboarding/step-4" element={<FounderStep4 />} />
<Route path="/founder/onboarding/step-5" element={<FounderStep5 />} />
<Route path="/founder/onboarding/step-6" element={<FounderStep6 />} />
<Route path="/founder/setup"   element={<Navigate to="/founder/onboarding/step-1" replace />} />
<Route path="/founder/summary" element={<Navigate to="/dashboard" replace />} />
```

Remove the now-unused `import FounderSetup from "@/dashboard/founders/setup";` and `import FounderSummary from "@/dashboard/founders/summary";` lines (the component files get deleted in Task 10, but the imports must go now to keep the build green).

- [ ] **Step 9: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -E "(FounderStep|FounderProgressBar|App\.tsx)"
```
Expected: zero matches. Global count ≤ 33. (Note: deleting the FounderSetup/FounderSummary imports while the files still exist is fine — unused files don't error.)

- [ ] **Step 10: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/onboarding/ frontend/src/App.tsx
git commit -m "feat(founder): 6-step onboarding wizard

Identity · Startup snapshot · Team & roles · Traction & metrics ·
Mission (why/winning/advantage/ownership philosophy) · Goals & links.
State persists to founderProfile on each step; final step sets
onboardingComplete and routes to /dashboard. Legacy /founder/setup
and /summary now redirect.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Pages

### Task 6: `Dashboard.tsx` (replaces `home.tsx`)

**Spec section:** "Dashboard"

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx`
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/dashboard/home.tsx`

- [ ] **Step 1: Create `Dashboard.tsx`**

Build per the spec's Dashboard section. Imports + structure:

```tsx
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle, TrendingUp } from "lucide-react";
import { useFounderProfile } from "@/contexts/UserContext";
import { formatRelative } from "@/lib/formatRelative";
import {
  signals, tasks as initialTasks, activeBuilds as initialBuilds,
  recentActivity, journey,
} from "@/dashboard/founders/section/data/mockData";
```

State + handlers:
```tsx
const navigate = useNavigate();
const { founderProfile: p } = useFounderProfile();
const [tasks, setTasks]       = useState(initialTasks);
const [builds, setBuilds]     = useState(initialBuilds);
const [openStage, setOpenStage] = useState<string | null>(null);

const firstName = p.name.split(" ")[0];
const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
const weeksBuilding = Math.max(1, Math.floor((Date.now() - new Date(`${p.foundingYear}-01-01`).getTime()) / (7 * 86_400_000)));

const toggleTask = (id: string) => {
  setTasks((cur) => cur.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  toast("Marked complete");
};
```

Sections to render (see spec for exact copy/layout):
1. Greeting strip: `Good morning, {firstName}.` · `{today}` · `Week {weeksBuilding} of building`
2. Startup hero (full width): `p.logoEmoji` + `p.startupName` + stage pill (`p.stage`, violet) + `p.oneLiner` + a 4-stat row (`p.users` Active users / `$${p.revenueMonthly}/mo` Revenue / `${p.openRoles.length} of 5` Open roles / `—` Top investor fit) + two ghost CTAs: `Edit startup details →` (→ `/founder/settings#startup`), `View public profile →` (→ `/founder/profile`). Hero body click → `/incubation-hub`.
3. Journey strip: map `journey[]`. Each stage shows label + a thin progress bar. Active stage bar `bg-violet-600`, complete `bg-violet-200`, upcoming `bg-slate-200`. Clicking a stage toggles `openStage` and renders an inline `detail` panel below the strip.
4. Two-column: Today's focus (`tasks` with working checkboxes + row→href + `View all tasks`→`/incubation-hub`) + Signals (`signals` rows linking to `href`).
5. Active builds: map `builds` (card: logo + name + stage pill + progress bar + `Open workspace`→`/workspaces/build?startup={id}`), plus a final `+ Start a side bet` tile that appends a new build to local state (use a simple `window.prompt`-free inline approach: a small Dialog OR — to keep it simple — append a stub build `{ id: "b-"+Date.now(), name: "New side bet", logoEmoji: "✨", stage: "Idea", oneLiner: "", progress: 0, isPrimary: false }` and toast "Side bet started"). Use the toast-append approach to avoid a Dialog dependency here.
6. Recent activity: map `recentActivity` with `formatRelative(timestampISO)`.
7. Hackathon Momentum empty-state card: heading "Hackathon Momentum", body copy from spec, disabled `Browse opportunities →` button with a `Soon` chip.

Visual rules: single violet-600 accent, soft tinted status pills, `tabular-nums` on stats, no emoji in headings (logo emoji is data), no gradients, no animate-pulse.

- [ ] **Step 2: Migrate the `/dashboard` route into FounderLayout + delete `home.tsx`**

In `App.tsx`:
- Remove `import Dashboard from "@/dashboard/home";` (the old default import).
- Add `import { Dashboard } from "@/dashboard/founders/section/components/founder/Dashboard";`
- Remove the standalone `<Route path="/dashboard" element={<Dashboard />} />`.
- Add a `FounderLayout` wrapper block (this is the first child route added to it):
```tsx
<Route element={<FounderLayout />}>
  <Route path="/dashboard"        element={<Dashboard />} />
  <Route path="/founder/profile"  element={<FounderProfile />} />
  <Route path="/founder/settings" element={<FounderSettings />} />
</Route>
```
NOTE: `FounderProfile` and `FounderSettings` are created in Tasks 7 and 8. To keep the build green in THIS task, only add the `/dashboard` child now:
```tsx
<Route element={<FounderLayout />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Route>
```
Tasks 7 and 8 add their child routes to this same block.

Delete the file:
```bash
cd /home/faithsax/techIT && rm frontend/src/dashboard/home.tsx
```

- [ ] **Step 3: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -E "(founder/Dashboard|home\.tsx|App\.tsx)"
```
Expected: zero matches (home.tsx no longer exists so it can't error; ensure nothing else imported it — `grep -rn "dashboard/home" frontend/src` should return nothing).

```bash
cd /home/faithsax/techIT && grep -rn "dashboard/home" frontend/src || echo "OK: no references to home.tsx"
```

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx frontend/src/App.tsx
git rm --cached frontend/src/dashboard/home.tsx 2>/dev/null || true
git add -A frontend/src/dashboard/home.tsx 2>/dev/null || true
git commit -m "feat(founder): equity-aware Dashboard, retire home.tsx

Greeting + startup hero (logo/name/stage/one-liner + traction stat
row), flattened 5-stage journey strip with inline stage detail,
Today's focus (working task checkboxes) + Signals, active builds with
workspace deep-links, recent activity, and a reserved Hackathon
Momentum empty-state. Replaces the gradient-tile home.tsx. Mounts
inside FounderLayout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `FounderProfile.tsx`

**Spec section:** "Profile"

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/founder/FounderProfile.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `FounderProfile.tsx`**

Read view of `founderProfile`. Build per the spec's Profile section. Imports:
```tsx
import { Link } from "react-router-dom";
import { Github, Linkedin, Globe, Twitter, ExternalLink, Check } from "lucide-react";
import { useFounderProfile } from "@/contexts/UserContext";
import { journey, endorsements } from "@/dashboard/founders/section/data/mockData";
```

Compute the verified flag:
```tsx
const v = p.verification;
const isVerified = v.github.verified || v.twitter.verified || v.linkedin.verified || v.personalSite.verified || v.nin.status === "verified";
```

Human-label maps (define inline):
```tsx
const ownershipLabel: Record<typeof p.ownershipPhilosophy, string> = {
  "equity-day-one": "Collaborators earn equity from day one",
  "cash-first-equity-later": "Cash-first now, equity at seed",
  "custom": "Custom — negotiated per-person",
};
const compLabel: Record<typeof p.compensationOffered, string> = {
  "equity-heavy": "Equity-heavy", "cash-equity-mix": "Cash + equity", "cash-heavy": "Cash-heavy",
};
const launchLabel: Record<typeof p.launchStatus, string> = {
  "pre-launch": "Pre-launch", "private-beta": "Private beta", "public": "Public",
};
```

Sections in order (per spec): header strip (avatar, name + `✓ Verified` chip if `isVerified`, title/location/years/founderType, headline, availability line), startup hero card, mission card (3 blocks), compensation philosophy card (`bg-violet-50 border-violet-200`), open roles tiles + `See all collaborators…`→`/matchresults?roles=...`, compact journey strip, recent endorsements (top 3 + link), pinned work (hidden if empty), verification badges chips row + `Complete verification →`, social links. `Edit profile`→`/founder/settings#identity`.

- [ ] **Step 2: Add the route to the FounderLayout block in App.tsx**

```tsx
import { FounderProfile } from "@/dashboard/founders/section/components/founder/FounderProfile";
// inside the <Route element={<FounderLayout />}> block:
<Route path="/founder/profile" element={<FounderProfile />} />
```

- [ ] **Step 3: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -E "(FounderProfile|App\.tsx)"
```
Expected: zero matches. Global ≤ 33.

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/FounderProfile.tsx frontend/src/App.tsx
git commit -m "feat(founder): public Profile view

Header with verified checkmark, startup hero, mission blocks,
Building-for-Ownership compensation card, open-role tiles linking to
matchresults, journey strip, top endorsements, pinned work,
verification badge chips, social links. Edit profile deep-links to
settings#identity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `Settings.tsx` (5 sections)

**Spec section:** "Settings"

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/founder/Settings.tsx`
- Modify: `frontend/src/App.tsx`

**Pattern:** Read `frontend/src/dashboard/collaborators/section/components/collab/Settings.tsx` — it has the left sub-nav + anchored sections + `Row`/`Input` helpers + the hash-scroll `useEffect` + the Roles section reading `useActiveRoles`. Reuse that skeleton; swap amber for violet, swap the section list, and add the Verification section (which Collaborator doesn't have).

- [ ] **Step 1: Create `Settings.tsx`**

Five anchored sections: `#identity`, `#startup`, `#verification`, `#notifications`, `#roles`. Sub-nav list:
```tsx
const sections = [
  { id: "identity",      label: "Account & Identity",  icon: User },
  { id: "startup",       label: "Startup & Roles",     icon: Rocket },
  { id: "verification",  label: "Verification",        icon: BadgeCheck },
  { id: "notifications", label: "Notifications",       icon: Bell },
  { id: "roles",         label: "Roles & Switching",   icon: UserCog },
];
```

Build all five sections per spec. State is grouped per section; each section has a `[Save]` that calls `updateFounderProfile(...)` + toast. Key handlers:

**Identity** — edits name/title/location/yearsBuilding/founderType/headline + the four link URLs + contact email (local-state only) + change-password (mock toast).

**Startup & Roles** — edits all of Step 2/3/4/5 fields in one form (four hr-divided blocks). `[Save]` writes them all.

**Verification** — three subcards. Use a local copy of `verification` and write with full nested spread:
```tsx
const [ver, setVer] = useState(founderProfile.verification);
const verifySocial = (key: "twitter" | "linkedin" | "personalSite") =>
  setVer((cur) => ({ ...cur, [key]: { ...cur[key], verified: true } }));
const unverifySocial = (key: "twitter" | "linkedin" | "personalSite") =>
  setVer((cur) => ({ ...cur, [key]: { ...cur[key], verified: false } }));
const connectGithub = () =>
  setVer((cur) => ({ ...cur, github: { ...cur.github, verified: true } }));
const disconnectGithub = () =>
  setVer((cur) => ({ ...cur, github: { ...cur.github, verified: false } }));
const submitNin = () => {
  setVer((cur) => ({ ...cur, nin: { ...cur.nin, status: "pending" } }));
  toast("Submitted — under review");
  // DEMO ONLY: auto-verify after 5s. Remove when a real verification API lands.
  setTimeout(() => setVer((cur) => ({ ...cur, nin: { ...cur.nin, status: "verified" } })), 5000);
};
```
The Verification `[Save]` persists `ver` to the profile: `updateFounderProfile({ verification: ver })`. (Each mutate already updates local state for instant feedback; Save commits to context. To keep it simple and avoid losing the GitHub Dialog/social toggles, Verification can persist on every mutate by calling `updateFounderProfile({ verification: nextVer })` inside each handler instead of requiring a separate Save — choose this approach so the Profile badges reflect changes immediately.)

GitHub OAuth uses a Dialog (import from `@/dashboard/collaborators/section/components/ui/dialog`): single "Continue to GitHub" button → `connectGithub()` + close + toast.

**Notifications** — four toggle groups + quiet hours, full nested spread on each toggle. `[Save]` → `updateFounderProfile({ notifications })` + toast.

**Roles & Switching** — read `useActiveRoles()`; render Founder/Collaborator/Investor/Org cards; `Switch to` (active) → `roleDashboardPath[role]`; `Activate role` (inactive) → `roleOnboardingPath[role]` (import both from `@/lib/roleRoutes`). Sign out → toast.

- [ ] **Step 2: Add the route to the FounderLayout block in App.tsx**

```tsx
import { Settings as FounderSettings } from "@/dashboard/founders/section/components/founder/Settings";
// inside the <Route element={<FounderLayout />}> block:
<Route path="/founder/settings" element={<FounderSettings />} />
```

- [ ] **Step 3: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -E "(founder/Settings|App\.tsx)"
```
Expected: zero matches. Global ≤ 33.

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/Settings.tsx frontend/src/App.tsx
git commit -m "feat(founder): Settings with Identity, Startup, Verification, Notifications, Roles

Five anchored sections. Verification has three subcards (social media,
GitHub mock-OAuth, NIN/ID with pending->verified mock timer) that drive
the Profile badge chips. Roles & Switching reuses the shared role-path
maps. Notifications uses nested-spread updates to avoid shallow-merge
data loss.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Wire-up + cleanup

### Task 9: Wrap IncubationHub / Chat / MatchResults in FounderLayout + strip global Sidebar from IncubationHub

**Spec sections:** "Routes", "Global Sidebar deletion blast radius"

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/dashboard/incubationHub.tsx`

- [ ] **Step 1: Move `/incubation-hub`, `/chat`, `/matchresults` into the FounderLayout block**

In `App.tsx`, find the standalone routes:
```tsx
<Route path="/incubation-hub" element={<IncubationHub />} />
<Route path="/chat" element={<Chat />} />
<Route path="/matchresults" element={<MatchResults />} />
```
Remove them from their standalone position and add them as children inside the existing `<Route element={<FounderLayout />}>` block, so it reads:
```tsx
<Route element={<FounderLayout />}>
  <Route path="/dashboard"        element={<Dashboard />} />
  <Route path="/founder/profile"  element={<FounderProfile />} />
  <Route path="/founder/settings" element={<FounderSettings />} />
  <Route path="/incubation-hub"   element={<IncubationHub />} />
  <Route path="/chat"             element={<Chat />} />
  <Route path="/matchresults"     element={<MatchResults />} />
</Route>
```

- [ ] **Step 2: Strip the global `<Sidebar />` from `incubationHub.tsx`**

`incubationHub.tsx` currently imports and renders the global `Sidebar` (and likely `MobileMenuButton`). Since the page now renders inside `FounderLayout` (which provides the sidebar), remove the `<Sidebar />` render and its import. Read the file first; locate:
```tsx
import Sidebar from "@/components/Sidebar";   // remove
```
and the JSX `<Sidebar />` (and any wrapping flex container that only existed to position the sidebar). Keep the page's own content; just remove the sidebar shell so it doesn't double up with FounderLayout's. If `MobileMenuButton` is also imported from the old shell and no longer needed, remove it too. Do the minimum: the page content stays, only the redundant sidebar chrome goes.

- [ ] **Step 3: Verify the IncubationHub still type-checks and has no dangling Sidebar references**

```bash
cd /home/faithsax/techIT
grep -n "Sidebar" frontend/src/dashboard/incubationHub.tsx || echo "OK: no Sidebar references left"
cd frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -E "(incubationHub|App\.tsx)"
```
Expected: no Sidebar references; zero new errors.

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/App.tsx frontend/src/dashboard/incubationHub.tsx
git commit -m "feat(founder): mount IncubationHub / Chat / MatchResults inside FounderLayout

Founder-experience routes now share the FounderLayout sidebar + top-bar
role menu. Strips the redundant global Sidebar render from
incubationHub.tsx since the layout provides it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Delete the global `Sidebar.tsx` + dead founder onboarding files

**Spec section:** "Files deleted"

**Files:**
- Delete: `frontend/src/components/Sidebar.tsx`
- Delete: `frontend/src/dashboard/founders/setup.tsx`
- Delete: `frontend/src/dashboard/founders/summary.tsx`
- Delete: `frontend/src/dashboard/founderSetup.tsx` (already gone on disk — stage removal)
- Delete: `frontend/src/dashboard/founderSummary.tsx` (already gone on disk — stage removal)

- [ ] **Step 1: Confirm nothing still imports the global Sidebar**

```bash
cd /home/faithsax/techIT
grep -rn "components/Sidebar" frontend/src || echo "OK: no imports of the global Sidebar"
```
Expected: `OK: no imports of the global Sidebar`. If anything still imports it (other than the file itself), STOP — that consumer needs migrating first.

- [ ] **Step 2: Confirm nothing imports the dead founder onboarding files**

```bash
cd /home/faithsax/techIT
grep -rn "founders/setup\|founders/summary\|dashboard/founderSetup\|dashboard/founderSummary" frontend/src || echo "OK: no imports"
```
Expected: `OK: no imports` (Task 5 already removed the App.tsx imports).

- [ ] **Step 3: Delete the files**

```bash
cd /home/faithsax/techIT
rm -f frontend/src/components/Sidebar.tsx \
      frontend/src/dashboard/founders/setup.tsx \
      frontend/src/dashboard/founders/summary.tsx
git rm frontend/src/dashboard/founderSetup.tsx frontend/src/dashboard/founderSummary.tsx 2>/dev/null || true
```

- [ ] **Step 4: Verify**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```
Expected: ≤ 33, and ideally lower (deleting these removes any errors they carried — e.g. the baseline `founderSummary` error vanishes).

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/techIT
git add -A
git commit -m "chore(founder): delete global Sidebar + dead onboarding files

Removes components/Sidebar.tsx (replaced by FounderLayout), the
founders/setup + founders/summary pages (replaced by the 6-step
wizard), and the two top-level founderSetup/founderSummary dupes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Final tone audit + verification

**Spec sections:** "Visual tone rules", "Definition of done"

**Files:**
- Audit (read + correct if needed): all files under `frontend/src/dashboard/founders/`

- [ ] **Step 1: Tone audit grep**

```bash
cd /home/faithsax/techIT/frontend/src/dashboard/founders
grep -rnE "animate-pulse|bg-gradient-to-(r|br)|from-violet-500|from-cyan|from-teal|from-rose|Demo User|🧠|🚨|💡|🤖|AI Insights|AI Score|AI Verified" . | grep -vE "logoEmoji|buildLogo|projectLogo" || echo "OK: clean"
```
Expected: `OK: clean`. The `grep -v` filters out legit data fields that hold the 🧠 emoji. Any other hit (gradient class, animate-pulse, "Demo User", AI-branded label) must be fixed before committing. If the 🧠 appears in a heading string rather than a data field, fix it.

- [ ] **Step 2: Confirm route table**

```bash
cd /home/faithsax/techIT
grep -nE "FounderLayout|FounderStep|founder/profile|founder/settings|/dashboard|/incubation-hub|/chat|/matchresults" frontend/src/App.tsx
```
Expected: 6 onboarding step routes + 2 legacy redirects + the FounderLayout block with 6 children (dashboard, profile, settings, incubation-hub, chat, matchresults). No standalone duplicates of those six.

- [ ] **Step 3: Final build + lint**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS" | grep -i "founder" || echo "OK: zero founder errors"
"/mnt/c/Program Files/nodejs/node.exe" node_modules/eslint/bin/eslint.js src/dashboard/founders/ src/lib/ src/App.tsx 2>&1 | tail -20
```
Expected: global ≤ 33, zero founder errors. Fix any lint errors in `founders/`, `lib/`, or `App.tsx` paths (ignore pre-existing lint in unrelated files).

- [ ] **Step 4: Commit (only if Step 1/3 required fixes; otherwise skip)**

```bash
cd /home/faithsax/techIT
git add -A
git commit -m "chore(founder): tone audit pass

No gradients, no animate-pulse, no Demo User, no AI-branded labels.
Single violet-600 accent throughout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand off for browser verification**

Notify the user that PR-A is ready. They run `npm run dev` from a native Windows terminal and walk:
1. `/` → "I'm a Founder" entry (or `/founder/onboarding/step-1` directly) → steps 1-6 → `/dashboard`
2. Dashboard: startup hero shows real name (not Demo User); journey stage click expands detail; task checkbox toggles; signals link out; `Edit startup details` → settings#startup
3. `/founder/profile`: verified checkmark reflects verification state; `Edit profile` → settings#identity; `See all collaborators` → matchresults
4. `/founder/settings`: all 5 sections; Verification GitHub Dialog connects; NIN submit flips pending→verified after 5s; Roles "Switch to Collaborator" → /collaborator/dashboard
5. Sidebar: Dashboard/Incubation Hub/Workspaces/Feed work; 3 Soon placeholders are inert; Messages → /chat; Investors → /matchresults; Wallet → /wallet
6. Top-bar role menu present on `/dashboard`, `/incubation-hub`, `/chat`, `/matchresults`

---

## Self-Review

Run against the spec with fresh eyes.

**Spec coverage:**
- ✓ Shared `@/lib/roleRoutes` + `@/lib/formatRelative` — Task 1
- ✓ `FounderProfile` + `useFounderProfile` + `useActiveRoles` update — Task 2
- ✓ Founder mock data — Task 3
- ✓ FounderLayout (white sidebar, violet accent, Soon placeholders, Feed/Wallet external, Messages/Investors fixed) + TopBarRoleMenu + defensive redirect — Task 4
- ✓ 6-step onboarding + progress bar + routes — Task 5
- ✓ Dashboard (hero, journey, tasks, signals, builds, activity, momentum empty-state) + home.tsx deletion — Task 6
- ✓ Profile (verified checkmark, startup hero, mission, comp, roles, journey, endorsements, pinned, verification chips, socials) — Task 7
- ✓ Settings 5 sections incl. Verification (social/GitHub/NIN) + Roles switcher — Task 8
- ✓ IncubationHub/Chat/MatchResults under FounderLayout + Sidebar surgery — Task 9
- ✓ Delete global Sidebar + dead founder files — Task 10
- ✓ Tone audit + final verify — Task 11
- ✓ Legacy `/founder/setup` + `/founder/summary` redirects — Task 5
- ✓ "Demo User" removal — enforced in Tasks 4, 6, and audited in Task 11

**Placeholder scan:** No "TBD"/"implement later". Tasks 6, 7, 8 describe page sections by referencing the spec's exact layout + provide all state/handlers/imports inline; the JSX presentation is left to the implementer guided by the spec section, which is acceptable for UI pages where the spec carries the visual detail. No "similar to Task N" without the actual code for shared helpers (the wizard shell explicitly says "mirror CollabStep1" and points at the file to read — the implementer reads the real file rather than a stale copy).

**Type consistency:** `FounderProfile`, `OpenRole`, `FounderStage`, `FounderExperience`, `LaunchStatus`, `CompModel`, `OwnershipPhilosophy`, `FounderVerification`, `FounderNotificationPrefs` defined in Task 2 and consumed consistently in Tasks 5-8. `Signal`, `FounderTask`, `Build`, `ActivityItem`, `JourneyStage`, `Endorsement` defined in Task 3 and consumed in Tasks 6-7. `roleDashboardPath`/`roleOnboardingPath` from `@/lib/roleRoutes` (Task 1) consumed in Tasks 4 and 8. `formatRelative` from `@/lib/formatRelative` (Task 1) consumed in Task 6.

**Issues found & fixed inline:**
- Task 4 Step 3 carried a route-conflict risk (adding `/founder/setup` redirect while the old route may still exist). Reworded to defer the redirect to Task 5, which is where the old `FounderSetup`/`FounderSummary` imports are actually removed. ✓
- Task 8 Verification originally had an ambiguous Save model (separate Save vs per-mutate persist). Resolved to persist on every mutate so Profile badges reflect immediately. ✓

---

Plan complete and saved to `docs/superpowers/plans/2026-05-28-founders-foundation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
