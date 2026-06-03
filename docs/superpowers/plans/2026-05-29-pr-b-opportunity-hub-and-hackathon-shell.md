# PR-B: Opportunity Hub + Hackathon shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the founder-side Opportunity Hub (browse hackathons + programs + funding + events from Organizations) and the hackathon team-formation flow end-to-end (register → share invite link → accept invites → find collaborators), refactoring the 873-line `incubationHub.tsx` into a layout with an internal Main/Hackathon sidebar toggle. Deep validation/AI scoring/momentum mechanics defer to PR-C.

**Architecture:** A new shared `_shared/opportunities/` module owns the unified `Opportunity` discriminated union (`Hackathon | Program | Funding | Event`) and the mock catalog. The Org-side `Hackathons.tsx` projects from this catalog so there's one source of truth. Founder-side adds three new top-level pages (`OpportunityHub`, `OpportunityDetail`, `InviteAcceptPage`) and refactors `incubationHub.tsx` into `IncubationLayout` (internal sidebar) + `MainIncubationPanel` (existing 873-line content moved verbatim) + `HackathonPanel` (new 5-stage pipeline with Discover + Register live; Submit Brief / Build / Submit & Pitch as PR-C empty states). `FounderProfile` gains a `hackathonRegistrations` array plus two updaters (`registerForHackathon`, `addHackathonMember`). `/matches` reused via `?hackathon=<id>` query param for hackathon-aware filtering.

**Tech Stack:** React 19, react-router-dom (`useParams`, `useSearchParams`, `useMatch`), TypeScript, Tailwind, lucide-react, sonner (toasts already wired in `FounderLayout` via `<Toaster />`), shadcn/ui primitives reused from `collaborators/section/components/ui/`. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-29-pr-b-opportunity-hub-and-hackathon-shell-design.md`](../specs/2026-05-29-pr-b-opportunity-hub-and-hackathon-shell-design.md). Read the relevant spec section before each task.

**Verification gate:** Every task ends with `tsc --noEmit` run from `frontend/` via the Windows node binary (npm's `build` script can't run from WSL — UNC path limitation):

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

**Baseline at branch cut (`eb7b190`): 31 errors.** All pre-existing. No task may increase this count. By end of plan it may drop (the IncubationHub split removes a long file from tsc's deepest dep graphs). No automated test framework exists — verification is `tsc` + the user's manual browser pass at the end (run `npm run dev` from a native Windows terminal; WSL can't bind the dev server reliably).

**Branch:** `feature/integrate-role-sections` (current, with the spec already committed at `eb7b190`). Do NOT switch branches. Do NOT create a sub-branch — PR-B continues on this branch.

**Tone & visual rules** (re-read before any UI task):
- Primary accent: `violet-600` only. **No gradients** (`bg-gradient-to-*`, `from-*` color stops). Solid swatches.
- Status colors: `open = emerald-600`, `closing-soon = amber-600`, `closed = slate-500`.
- Badges: `bg-{color}-50 text-{color}-700 border border-{color}-200`.
- Type chips on `OpportunityCard`: uppercase 10px, `slate-700` on `slate-100`. **No type-specific colors** — keeps the catalog visually unified.
- **No `animate-pulse`.** Loading states use static skeletons (`bg-slate-100 rounded`).
- **No emoji in `<h1>` / `<h2>`.** The `poster` field on opportunities is data, rendered in plain spans/divs.
- **No "Demo User."** Leader name from `founderProfile.name`. Mock collaborator on `InviteAcceptPage` is the literal string `"Sample Collaborator"`.
- **No `Date.now()` / `Math.random()` directly in render bodies** (`react-hooks/purity` ESLint rule). Wrap in `useMemo` or compute at module load. The `crypto.getRandomValues` invite-token generation is a one-shot inside an event handler — that's allowed.

**Reference files to read before starting:**
- `frontend/src/dashboard/_shared/_README` — none yet; this PR creates the first `_shared/` subfolder. Pattern: type definitions in `types.ts`, mock data in `data.ts`, no React.
- `frontend/src/dashboard/organization/section/components/org/Hackathons.tsx` — current Org hackathon list (4 mock entries to port).
- `frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx` — the `comingSoonNav` array where the Opportunity Hub placeholder lives.
- `frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx` lines 254-275 — the empty-state Hackathon Momentum card.
- `frontend/src/dashboard/incubationHub.tsx` — the 873-line file being refactored. Must move content **verbatim** in Task 3 — zero logic changes.
- `frontend/src/dashboard/matchResults.tsx` — the `Match` interface (fields: `name`, `role`, `match`, `skills`, `avatar`, `risk`, `hours`) and the existing card chrome.
- `frontend/src/contexts/UserContext.tsx` lines 159-202 — `FounderProfile` interface; lines 304-357 — initial founder state. The shallow-merge gotcha is documented at lines 359-363.

---

## Task 1: Shared opportunities types + data module

**Files:**
- Create: `frontend/src/dashboard/_shared/opportunities/types.ts`
- Create: `frontend/src/dashboard/_shared/opportunities/data.ts`

**Goal:** Land the unified `Opportunity` discriminated union and the mock catalog. No consumers yet — that's the next tasks.

- [ ] **Step 1: Create the types file**

Write `frontend/src/dashboard/_shared/opportunities/types.ts`:

```ts
export type OpportunityType = "hackathon" | "program" | "funding" | "event";
export type OpportunityStatus = "open" | "closing-soon" | "closed";

interface OpportunityBase {
  id: string;
  type: OpportunityType;
  title: string;
  organizer: { id: string; name: string; logoEmoji?: string };
  poster: string;
  summary: string;
  status: OpportunityStatus;
  applyDeadline: string;
  publishedAt: string;
  tags: string[];
  featured?: boolean;
}

export interface Hackathon extends OpportunityBase {
  type: "hackathon";
  theme: string;
  startDate: string;
  endDate: string;
  durationHours: number;
  prizePool: string;
  partners: string[];
  registrants: number;
  teamsFormed: number;
  hackathonStatus: "upcoming" | "live" | "judging" | "completed";
}

export interface Program extends OpportunityBase {
  type: "program";
  format: "incubator" | "accelerator" | "mentorship";
  durationWeeks: number;
  cohortSize: number;
  perks: string[];
  startDate: string;
}

export interface Funding extends OpportunityBase {
  type: "funding";
  format: "grant" | "rfp" | "pilot";
  amountRange: string;
  equityRequired: boolean;
  audienceStage: ("Idea" | "MVP" | "Beta" | "Launch" | "Growth")[];
}

export interface Event extends OpportunityBase {
  type: "event";
  format: "demo-day" | "masterclass" | "ama" | "panel" | "workshop";
  startDate: string;
  durationMinutes: number;
  hostedBy: string;
  isVirtual: boolean;
}

export type Opportunity = Hackathon | Program | Funding | Event;
```

- [ ] **Step 2: Create the data module**

Write `frontend/src/dashboard/_shared/opportunities/data.ts`. The 4 hackathons must keep the same `id`, `title`, `theme`, dates, `durationHours`, `registrants`, `teamsFormed`, `prizePool`, `partners`, and `status` fields as Org's existing `Hackathons.tsx` so the Org page works after Task 2. Map `status` → `hackathonStatus`. Add the new `OpportunityBase` fields per entry.

```ts
import type { Hackathon, Program, Funding, Event, Opportunity } from "./types";

const TECHIT = { id: "org_techit", name: "TechIT Foundation", logoEmoji: "🌐" };
const GOOGLE = { id: "org_google", name: "Google for Startups", logoEmoji: "🟦" };
const FLUTTERWAVE = { id: "org_flutterwave", name: "Flutterwave", logoEmoji: "💸" };
const WHO_AFRICA = { id: "org_who", name: "WHO Africa", logoEmoji: "🩺" };
const TECHSTARS = { id: "org_techstars", name: "TechStars", logoEmoji: "⭐" };
const FELLOWSHIP = { id: "org_abf", name: "African Builders Fellowship", logoEmoji: "🪴" };
const SEQUOIA = { id: "org_sequoia", name: "Sequoia Spark", logoEmoji: "🌲" };
const MTN = { id: "org_mtn", name: "MTN Y'ello", logoEmoji: "📡" };
const VISA = { id: "org_visa", name: "Visa", logoEmoji: "💳" };
const SOLVE = { id: "org_solve", name: "MIT Solve", logoEmoji: "🧪" };
const YC = { id: "org_yc", name: "Y Combinator", logoEmoji: "🟧" };
const STRIPE = { id: "org_stripe", name: "Stripe", logoEmoji: "💼" };

export const HACKATHONS: Hackathon[] = [
  {
    id: "ai-for-africa-2026",
    type: "hackathon",
    title: "AI for Africa 2026",
    organizer: TECHIT,
    poster: "🤖",
    summary: "Build AI agents that solve a real African problem in 48 hours.",
    status: "open",
    applyDeadline: "2026-06-10",
    publishedAt: "2026-04-20",
    tags: ["AI", "Africa", "Agents"],
    featured: true,
    theme: "AI agents that solve a real African problem",
    startDate: "2026-06-12",
    endDate: "2026-06-14",
    durationHours: 48,
    prizePool: "$50,000",
    partners: ["TechIT", "Google for Startups", "Lagos Innovation Hub"],
    registrants: 420,
    teamsFormed: 87,
    hackathonStatus: "upcoming",
  },
  {
    id: "climate-builders-q2",
    type: "hackathon",
    title: "Climate Builders Q2",
    organizer: TECHIT,
    poster: "🌱",
    summary: "Carbon, water, and agriculture in emerging markets.",
    status: "open",
    applyDeadline: "2026-05-20",
    publishedAt: "2026-03-30",
    tags: ["Climate", "AgriTech"],
    theme: "Carbon, water, and agriculture in emerging markets",
    startDate: "2026-05-22",
    endDate: "2026-05-24",
    durationHours: 48,
    prizePool: "$30,000",
    partners: ["TechIT", "GreenTech Foundation"],
    registrants: 280,
    teamsFormed: 62,
    hackathonStatus: "live",
  },
  {
    id: "fintech-fast-track",
    type: "hackathon",
    title: "FinTech Fast Track",
    organizer: FLUTTERWAVE,
    poster: "💸",
    summary: "Cross-border payments for SMEs.",
    status: "closed",
    applyDeadline: "2026-04-08",
    publishedAt: "2026-02-15",
    tags: ["FinTech", "Payments"],
    theme: "Cross-border payments for SMEs",
    startDate: "2026-04-10",
    endDate: "2026-04-12",
    durationHours: 48,
    prizePool: "$40,000",
    partners: ["Flutterwave", "TechIT"],
    registrants: 312,
    teamsFormed: 71,
    hackathonStatus: "judging",
  },
  {
    id: "healthx-spring",
    type: "hackathon",
    title: "HealthX Spring",
    organizer: WHO_AFRICA,
    poster: "🩺",
    summary: "Telemedicine for rural clinics.",
    status: "closed",
    applyDeadline: "2026-02-12",
    publishedAt: "2026-01-05",
    tags: ["HealthTech", "Telemedicine"],
    theme: "Telemedicine for rural clinics",
    startDate: "2026-02-14",
    endDate: "2026-02-16",
    durationHours: 48,
    prizePool: "$25,000",
    partners: ["WHO Africa", "TechIT"],
    registrants: 198,
    teamsFormed: 44,
    hackathonStatus: "completed",
  },
];

export const PROGRAMS: Program[] = [
  {
    id: "techstars-tools-2026",
    type: "program",
    title: "TechStars Tools Cohort 24",
    organizer: TECHSTARS,
    poster: "⭐",
    summary: "12-week accelerator for B2B SaaS founders. $25k stipend + mentorship.",
    status: "closing-soon",
    applyDeadline: "2026-06-01",
    publishedAt: "2026-04-01",
    tags: ["B2B", "SaaS", "Accelerator"],
    featured: true,
    format: "accelerator",
    durationWeeks: 12,
    cohortSize: 12,
    perks: ["$25k stipend", "Office space (London)", "Demo Day", "1:1 mentor"],
    startDate: "2026-07-01",
  },
  {
    id: "african-builders-fellowship",
    type: "program",
    title: "African Builders Fellowship",
    organizer: FELLOWSHIP,
    poster: "🪴",
    summary: "6-month incubator for early-stage African founders.",
    status: "open",
    applyDeadline: "2026-08-30",
    publishedAt: "2026-05-01",
    tags: ["Incubator", "Africa", "Pre-seed"],
    format: "incubator",
    durationWeeks: 26,
    cohortSize: 20,
    perks: ["$10k grant", "Weekly mentor circles", "Investor intros"],
    startDate: "2026-09-15",
  },
  {
    id: "sequoia-spark-mentorship",
    type: "program",
    title: "Sequoia Spark Mentorship",
    organizer: SEQUOIA,
    poster: "🌲",
    summary: "3-month 1:1 mentorship from Sequoia partners. Application-only.",
    status: "open",
    applyDeadline: "2026-07-15",
    publishedAt: "2026-05-12",
    tags: ["Mentorship", "Seed"],
    format: "mentorship",
    durationWeeks: 12,
    cohortSize: 30,
    perks: ["1:1 monthly with a Sequoia partner", "Founder retreat"],
    startDate: "2026-08-01",
  },
];

export const FUNDING: Funding[] = [
  {
    id: "google-cloud-credits-africa",
    type: "funding",
    title: "Google for Startups Africa Cloud Credits",
    organizer: GOOGLE,
    poster: "🟦",
    summary: "Up to $100k in Google Cloud credits for African startups.",
    status: "open",
    applyDeadline: "2026-09-01",
    publishedAt: "2026-04-15",
    tags: ["Cloud", "Credits", "Africa"],
    format: "grant",
    amountRange: "$10k – $100k",
    equityRequired: false,
    audienceStage: ["MVP", "Beta", "Launch"],
  },
  {
    id: "mtn-yello-pilot-rfp",
    type: "funding",
    title: "MTN Y'ello Pilot RFP",
    organizer: MTN,
    poster: "📡",
    summary: "Pilot opportunity for telco-adjacent startups across Africa.",
    status: "closing-soon",
    applyDeadline: "2026-05-31",
    publishedAt: "2026-04-20",
    tags: ["Telco", "Pilot", "Africa"],
    format: "pilot",
    amountRange: "Pilot contract",
    equityRequired: false,
    audienceStage: ["Beta", "Launch", "Growth"],
  },
  {
    id: "visa-fintech-fast-track-grant",
    type: "funding",
    title: "Visa FinTech Fast-Track Grant",
    organizer: VISA,
    poster: "💳",
    summary: "Non-dilutive grant + Visa network access for FinTech founders.",
    status: "open",
    applyDeadline: "2026-08-15",
    publishedAt: "2026-05-05",
    tags: ["FinTech", "Grant"],
    format: "grant",
    amountRange: "$50k – $250k",
    equityRequired: false,
    audienceStage: ["Beta", "Launch"],
  },
  {
    id: "mit-solve-climate",
    type: "funding",
    title: "MIT Solve Climate Challenge",
    organizer: SOLVE,
    poster: "🧪",
    summary: "Equity-light funding for climate-tech ventures with MIT mentorship.",
    status: "open",
    applyDeadline: "2026-07-30",
    publishedAt: "2026-05-10",
    tags: ["Climate", "Research"],
    format: "grant",
    amountRange: "$100k – $500k",
    equityRequired: true,
    audienceStage: ["Idea", "MVP", "Beta"],
  },
];

export const EVENTS: Event[] = [
  {
    id: "yc-demo-day-watch-party",
    type: "event",
    title: "YC Demo Day Watch Party",
    organizer: YC,
    poster: "🟧",
    summary: "Watch the latest YC batch demo and network with Lagos founders.",
    status: "open",
    applyDeadline: "2026-06-04",
    publishedAt: "2026-05-15",
    tags: ["Networking", "YC"],
    format: "demo-day",
    startDate: "2026-06-05T15:00:00Z",
    durationMinutes: 180,
    hostedBy: "TechIT Lagos",
    isVirtual: false,
  },
  {
    id: "lagos-founder-ama-iyin",
    type: "event",
    title: "Founder AMA with Iyin Aboyeji",
    organizer: TECHIT,
    poster: "🎙",
    summary: "Live Q&A with Future Africa's founding partner.",
    status: "open",
    applyDeadline: "2026-06-09",
    publishedAt: "2026-05-18",
    tags: ["AMA", "Africa"],
    format: "ama",
    startDate: "2026-06-10T17:00:00Z",
    durationMinutes: 90,
    hostedBy: "TechIT Foundation",
    isVirtual: true,
  },
  {
    id: "stripe-atlas-workshop",
    type: "event",
    title: "Stripe Atlas Workshop: Incorporate from Anywhere",
    organizer: STRIPE,
    poster: "💼",
    summary: "Hands-on session: incorporate a Delaware C-corp via Stripe Atlas.",
    status: "open",
    applyDeadline: "2026-06-19",
    publishedAt: "2026-05-20",
    tags: ["Workshop", "Legal"],
    format: "workshop",
    startDate: "2026-06-20T14:00:00Z",
    durationMinutes: 120,
    hostedBy: "Stripe",
    isVirtual: true,
  },
];

export const OPPORTUNITIES: Opportunity[] = [...HACKATHONS, ...PROGRAMS, ...FUNDING, ...EVENTS];

export function findOpportunity(id: string): Opportunity | undefined {
  return OPPORTUNITIES.find((o) => o.id === id);
}

export function findHackathon(id: string): Hackathon | undefined {
  return HACKATHONS.find((h) => h.id === id);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from `/home/faithsax/techIT/frontend`:

```bash
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31` (no change from baseline — no consumers yet).

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/_shared/opportunities/
git commit -m "feat(opportunities): shared types + mock catalog (4 hackathons, 3 programs, 4 funding, 3 events)"
```

---

## Task 2: Wire Org's Hackathons.tsx to import from the shared module

**Files:**
- Modify: `frontend/src/dashboard/organization/section/components/org/Hackathons.tsx` lines 12-81

**Goal:** One source of truth. Org's `HackathonListItem` shape stays intact (no UI change), but the data array projects from `HACKATHONS` in the shared module.

- [ ] **Step 1: Read the current Org Hackathons file**

Read `frontend/src/dashboard/organization/section/components/org/Hackathons.tsx` lines 1-90 to see the existing local `HackathonListItem` type and `hackathons` array.

- [ ] **Step 2: Replace the local data array with a projection**

In `frontend/src/dashboard/organization/section/components/org/Hackathons.tsx`, replace lines 12-81 (the `HackathonStatus` type, `HackathonListItem` interface, and `hackathons: HackathonListItem[] = [...]` 4-entry literal) with:

```ts
import { HACKATHONS } from "@/dashboard/_shared/opportunities/data";

type HackathonStatus = "upcoming" | "live" | "judging" | "completed";

interface HackathonListItem {
  id: string;
  title: string;
  theme: string;
  startDate: string;
  endDate: string;
  durationHours: number;
  registrants: number;
  teamsFormed: number;
  prizePool: string;
  partners: string[];
  status: HackathonStatus;
}

const hackathons: HackathonListItem[] = HACKATHONS.map((h) => ({
  id: h.id,
  title: h.title,
  theme: h.theme,
  startDate: h.startDate,
  endDate: h.endDate,
  durationHours: h.durationHours,
  registrants: h.registrants,
  teamsFormed: h.teamsFormed,
  prizePool: h.prizePool,
  partners: h.partners,
  status: h.hackathonStatus,
}));
```

The `import` line goes at the **top** of the file, with the other imports. The local `HackathonStatus` + `HackathonListItem` remain (Org's local UI shape).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31` (no change).

- [ ] **Step 4: Smoke-test the Org Hackathons page rendering**

Run a render-shape grep — confirm the projection produces 4 items:

```bash
cd /home/faithsax/techIT
grep -c "id:" frontend/src/dashboard/_shared/opportunities/data.ts
```

Expected: at least 14 (4 hackathons + 3 programs + 4 funding + 3 events × 1 `id:` each = 14, plus organizer ids).

User does a manual browser pass after Task 12 — but for now confirm the projection function compiles and shape matches.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dashboard/organization/section/components/org/Hackathons.tsx
git commit -m "refactor(org): hackathon list projects from shared opportunities catalog"
```

---

## Task 3: UserContext additions — HackathonRegistration + updaters

**Files:**
- Modify: `frontend/src/contexts/UserContext.tsx` (add types around line 158, add fields to `FounderProfile` ~line 200, add updaters ~line 365, expose on context value ~line 213, add to provider value ~line 378, hook addition ~line 437)

**Goal:** Land the data shape and updaters before any consumer needs them. Defaults to `[]` so existing PR-A code keeps working unchanged.

- [ ] **Step 1: Add the new types**

In `frontend/src/contexts/UserContext.tsx`, after line 157 (after the `FounderNotificationPrefs` interface, before `FounderProfile`), insert:

```ts
export interface HackathonTeamMember {
  collaboratorId: string;
  name: string;
  role: string;
  acceptedAt: string;
}

export interface HackathonRegistration {
  hackathonId: string;
  teamId: string;
  teamName: string;
  teamSize: number;
  role: "leader" | "member";
  inviteToken: string;
  registeredAt: string;
  members: HackathonTeamMember[];
  openRoles: OpenRole[];
  stage: "registered" | "submitted" | "building" | "submitted-final";
  rosterClosed?: boolean;
}
```

- [ ] **Step 2: Add `hackathonRegistrations` to `FounderProfile`**

In the same file, find the `FounderProfile` interface (starts around line 159). Add the field at the end, right before the closing brace `}`:

```ts
  // Hackathon participation (PR-B)
  hackathonRegistrations: HackathonRegistration[];
```

- [ ] **Step 3: Initialize the field in the default profile**

Find the `useState<FounderProfile>({...})` call (around line 304). Inside the initial-state object, add (right after the `notifications: { ... }` block, before the closing `}`):

```ts
    hackathonRegistrations: [],
```

- [ ] **Step 4: Add the two new updaters**

After the existing `updateFounderProfile` function (around line 364-366), add:

```ts
  const registerForHackathon = (reg: HackathonRegistration) => {
    setFounderProfile((prev) => ({
      ...prev,
      hackathonRegistrations: [...prev.hackathonRegistrations, reg],
    }));
  };

  const addHackathonMember = (teamId: string, member: HackathonTeamMember) => {
    setFounderProfile((prev) => ({
      ...prev,
      hackathonRegistrations: prev.hackathonRegistrations.map((r) =>
        r.teamId === teamId
          ? {
              ...r,
              members: [...r.members, member],
              openRoles: r.openRoles.filter((role) => role !== member.role),
            }
          : r,
      ),
    }));
  };

  const updateHackathonRegistration = (
    teamId: string,
    updates: Partial<Omit<HackathonRegistration, "hackathonId" | "teamId" | "registeredAt">>,
  ) => {
    setFounderProfile((prev) => ({
      ...prev,
      hackathonRegistrations: prev.hackathonRegistrations.map((r) =>
        r.teamId === teamId ? { ...r, ...updates } : r,
      ),
    }));
  };
```

(The third updater handles roster-close + future per-team flag flips — used by the Manage Team drawer in Task 6.)

- [ ] **Step 5: Expose updaters on `UserContextType`**

Find `interface UserContextType` (around line 204). Add the three signatures after `updateFounderProfile`:

```ts
  registerForHackathon: (reg: HackathonRegistration) => void;
  addHackathonMember: (teamId: string, member: HackathonTeamMember) => void;
  updateHackathonRegistration: (
    teamId: string,
    updates: Partial<Omit<HackathonRegistration, "hackathonId" | "teamId" | "registeredAt">>,
  ) => void;
```

- [ ] **Step 6: Add updaters to the provider value**

In the `<UserContext.Provider value={{ ... }}>` block (around line 369-379), add the three names after `updateFounderProfile`:

```tsx
        registerForHackathon,
        addHackathonMember,
        updateHackathonRegistration,
```

- [ ] **Step 7: Extend the convenience hook**

Update `useFounderProfile` (around line 435-438):

```ts
export function useFounderProfile() {
  const {
    founderProfile,
    updateFounderProfile,
    registerForHackathon,
    addHackathonMember,
    updateHackathonRegistration,
  } = useUser();
  return {
    founderProfile,
    updateFounderProfile,
    registerForHackathon,
    addHackathonMember,
    updateHackathonRegistration,
  };
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31` (no change). If it goes up, the most likely cause is the `Omit<>` generic on `updateHackathonRegistration` — double-check the field-name spelling.

- [ ] **Step 9: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/contexts/UserContext.tsx
git commit -m "feat(context): HackathonRegistration types + register/add-member/update updaters"
```

---

## Task 4: IncubationLayout shell + sidebar split (move existing content verbatim into MainIncubationPanel)

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/incubation/IncubationLayout.tsx`
- Create: `frontend/src/dashboard/founders/section/components/incubation/MainIncubationPanel.tsx`
- Modify: `frontend/src/dashboard/incubationHub.tsx` (becomes a 5-line shim)

**Goal:** Split the 873-line `incubationHub.tsx` so the outer page is a layout with an internal sidebar, the existing content moves verbatim into `MainIncubationPanel`, and `incubationHub.tsx` becomes a default-export shim. The `HackathonPanel` slot is a placeholder this task — Task 5 fills it in. Zero logic changes to the existing content.

**Critical:** The Main Incubation content must move **verbatim**. No prop renaming, no logic refactor, no comment changes beyond what's needed to relocate. If verification turns up any visible behavior change, revert and re-do as a literal copy-paste.

- [ ] **Step 1: Create MainIncubationPanel.tsx as a verbatim copy of the existing content**

The current `incubationHub.tsx` is 873 lines — copy it whole into the new file:

```bash
cp /home/faithsax/techIT/frontend/src/dashboard/incubationHub.tsx \
   /home/faithsax/techIT/frontend/src/dashboard/founders/section/components/incubation/MainIncubationPanel.tsx
```

Then open the new file and rename the default export:
- Find `export default function IncubationHub()` (line ~167) → change to `export function MainIncubationPanel()`.
- Drop the `default` keyword. The component is now a named export.
- All internal helpers (`PROBLEM_AREAS`, `ProgressBar`, `CircularProgress`, `navItems`, `metrics`, `circleMetrics`, `risks`, `roadmap`, `teamRoles`, `insights`) stay where they are.

Verify the imports at the top of the new file are unchanged (lucide-react icons, `useNavigate` from react-router-dom, etc.). The relative imports from inside `incubationHub.tsx` were absolute (`@/...`), so no path adjustments needed.

- [ ] **Step 2: Create IncubationLayout.tsx (the outer shell + internal sidebar)**

Write `frontend/src/dashboard/founders/section/components/incubation/IncubationLayout.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, Trophy } from "lucide-react";
import { useFounderProfile } from "@/contexts/UserContext";
import { MainIncubationPanel } from "./MainIncubationPanel";
import { HackathonPanel } from "./HackathonPanel";

type Panel = "main" | "hackathon";

export default function IncubationLayout() {
  const [searchParams] = useSearchParams();
  const initialPanel: Panel = searchParams.get("panel") === "hackathon" ? "hackathon" : "main";
  const [panel, setPanel] = useState<Panel>(initialPanel);

  const { founderProfile } = useFounderProfile();
  const registrationCount = useMemo(
    () => founderProfile.hackathonRegistrations.length,
    [founderProfile.hackathonRegistrations.length],
  );

  return (
    <div className="flex h-full min-h-[calc(100vh-3.5rem)]">
      <aside className="w-16 shrink-0 bg-white border-r border-slate-200 flex flex-col items-stretch py-4 gap-2">
        <SidebarPill
          label="Main"
          icon={<Brain className="w-5 h-5" />}
          active={panel === "main"}
          onClick={() => setPanel("main")}
        />
        <SidebarPill
          label="Hack"
          icon={<Trophy className="w-5 h-5" />}
          active={panel === "hackathon"}
          onClick={() => setPanel("hackathon")}
          badge={registrationCount > 0 ? registrationCount : undefined}
        />
      </aside>
      <div className="flex-1 min-w-0">
        {panel === "main" ? <MainIncubationPanel /> : <HackathonPanel />}
      </div>
    </div>
  );
}

function SidebarPill({
  label,
  icon,
  active,
  badge,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 py-3 mx-2 rounded-lg text-[10px] font-medium uppercase tracking-wider transition ${
        active
          ? "border-l-2 border-violet-500 bg-violet-50 text-violet-700"
          : "text-slate-600 hover:bg-slate-50"
      }`}
      aria-pressed={active}
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Create a placeholder HackathonPanel.tsx (Task 5 will replace this)**

Write `frontend/src/dashboard/founders/section/components/incubation/HackathonPanel.tsx`:

```tsx
export function HackathonPanel() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-slate-900">Hackathon</h1>
      <p className="text-sm text-slate-600 mt-2">Pipeline lands in Task 5.</p>
    </div>
  );
}
```

This is intentionally minimal — Task 5 replaces it.

- [ ] **Step 4: Replace `incubationHub.tsx` with a shim**

Overwrite `frontend/src/dashboard/incubationHub.tsx` (the 873-line file) with:

```tsx
import IncubationLayout from "./founders/section/components/incubation/IncubationLayout";

export default IncubationLayout;
```

That's the entire file. The route in `App.tsx` (`<IncubationHub />`) keeps working because the default export still resolves to the layout.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31` (unchanged). If higher, check that `MainIncubationPanel.tsx` still has all the imports the original file had — copy-paste sometimes loses leading lines.

- [ ] **Step 6: Manual smoke test (REQUIRED before commit)**

The IncubationHub is the most-used page on the Founder side. Before committing:
1. Tell the user: "Task 4 refactor done. Please open `/incubation-hub` in the browser and confirm the Main Incubation surface (16 tools, copilot, structured idea form, doc preview) looks and behaves exactly as before. The new internal sidebar should show two pills: Main (Brain icon, active) and Hack (Trophy icon)."
2. If the user reports any visible regression, fix it before committing.
3. If the user confirms parity, proceed.

- [ ] **Step 7: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/incubationHub.tsx \
        frontend/src/dashboard/founders/section/components/incubation/IncubationLayout.tsx \
        frontend/src/dashboard/founders/section/components/incubation/MainIncubationPanel.tsx \
        frontend/src/dashboard/founders/section/components/incubation/HackathonPanel.tsx
git commit -m "refactor(incubation): split IncubationHub into IncubationLayout + MainIncubationPanel"
```

---

## Task 5: HackathonPanel — 5-stage pipeline shell + StagePill component

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/incubation/hackathon/StagePill.tsx`
- Modify: `frontend/src/dashboard/founders/section/components/incubation/HackathonPanel.tsx` (replace placeholder)

**Goal:** Replace the placeholder `HackathonPanel` with the 5-stage pipeline shell. Discover and Register are stub'd (filled in Task 6 / Task 7); Submit Brief / Build / Submit & Pitch render the PR-C empty state.

- [ ] **Step 1: Create StagePill.tsx**

Write `frontend/src/dashboard/founders/section/components/incubation/hackathon/StagePill.tsx`:

```tsx
import { Check } from "lucide-react";

export type StageState = "active" | "completed" | "upcoming";

export function StagePill({
  index,
  label,
  state,
  onClick,
  compact = false,
}: {
  index: number;
  label: string;
  state: StageState;
  onClick?: () => void;
  compact?: boolean;
}) {
  const styles =
    state === "active"
      ? "border-violet-500 bg-violet-50 text-violet-700"
      : state === "completed"
      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-white text-slate-500";

  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-center gap-2 border rounded-full ${
        compact ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm"
      } font-medium transition ${styles} ${onClick ? "hover:brightness-95 cursor-pointer" : ""}`}
      aria-current={state === "active" ? "step" : undefined}
    >
      <span
        className={`flex items-center justify-center rounded-full ${
          compact ? "w-4 h-4 text-[10px]" : "w-5 h-5 text-xs"
        } font-semibold ${
          state === "completed" ? "bg-emerald-500 text-white" : state === "active" ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {state === "completed" ? <Check className="w-3 h-3" /> : index}
      </span>
      <span>{label}</span>
    </Tag>
  );
}
```

- [ ] **Step 2: Replace HackathonPanel.tsx with the 5-stage shell**

Overwrite `frontend/src/dashboard/founders/section/components/incubation/HackathonPanel.tsx`:

```tsx
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Lightbulb, Hammer, Send } from "lucide-react";
import { useFounderProfile } from "@/contexts/UserContext";
import { StagePill } from "./hackathon/StagePill";
import { DiscoverStage } from "./hackathon/DiscoverStage";
import { RegisterStage } from "./hackathon/RegisterStage";

type StageId = "discover" | "register" | "brief" | "build" | "submit";

const STAGES: { id: StageId; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "register", label: "Register" },
  { id: "brief", label: "Submit Brief" },
  { id: "build", label: "Build" },
  { id: "submit", label: "Submit & Pitch" },
];

export function HackathonPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stageParam = searchParams.get("stage");
  const { founderProfile } = useFounderProfile();

  const activeStage: StageId = useMemo(() => {
    if (stageParam === "register") return "register";
    if (stageParam === "brief" || stageParam === "build" || stageParam === "submit") return stageParam;
    return "discover";
  }, [stageParam]);

  const setStage = (id: StageId) => {
    const next = new URLSearchParams(searchParams);
    next.set("panel", "hackathon");
    next.set("stage", id);
    if (id === "discover") next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  const registrations = founderProfile.hackathonRegistrations;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Hackathon</h1>
        <p className="text-sm text-slate-600 mt-1">
          Browse hackathons, register a team, and ship together.
        </p>
      </div>

      {/* Stage pill strip */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {STAGES.map((stage, i) => {
          const state = stage.id === activeStage ? "active" : "upcoming";
          return (
            <div key={stage.id} className="flex items-center gap-2">
              <StagePill
                index={i + 1}
                label={stage.label}
                state={state}
                onClick={() => setStage(stage.id)}
              />
              {i < STAGES.length - 1 && (
                <span className="text-slate-300 text-xs">— — —</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage content */}
      {activeStage === "discover" && <DiscoverStage registrations={registrations} />}
      {activeStage === "register" && <RegisterStage />}
      {activeStage === "brief" && <ComingInPRC stage="Submit Brief" icon={<Lightbulb className="w-8 h-8 text-slate-300" />} />}
      {activeStage === "build" && <ComingInPRC stage="Build" icon={<Hammer className="w-8 h-8 text-slate-300" />} />}
      {activeStage === "submit" && <ComingInPRC stage="Submit & Pitch" icon={<Send className="w-8 h-8 text-slate-300" />} />}
    </div>
  );
}

function ComingInPRC({ stage, icon }: { stage: string; icon: React.ReactNode }) {
  return (
    <div className="border border-slate-200 bg-white rounded-xl p-12 flex flex-col items-center justify-center text-center">
      <div className="mb-4">{icon}</div>
      <h2 className="text-base font-semibold text-slate-700 mb-2">{stage} — coming in PR-C</h2>
      <p className="text-sm text-slate-500 max-w-md">
        The validation sprint, build phase, and submission flow go live next. For now, browse hackathons and register a team in the earlier stages.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create stub DiscoverStage and RegisterStage so the import resolves**

These are full implementations in Tasks 6 and 7 — for now, write minimal stubs.

`frontend/src/dashboard/founders/section/components/incubation/hackathon/DiscoverStage.tsx`:

```tsx
import type { HackathonRegistration } from "@/contexts/UserContext";

export function DiscoverStage({ registrations: _registrations }: { registrations: HackathonRegistration[] }) {
  return <div className="text-sm text-slate-600">Discover stage — Task 6.</div>;
}
```

`frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisterStage.tsx`:

```tsx
export function RegisterStage() {
  return <div className="text-sm text-slate-600">Register stage — Task 7.</div>;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31`.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/incubation/hackathon/StagePill.tsx \
        frontend/src/dashboard/founders/section/components/incubation/hackathon/DiscoverStage.tsx \
        frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisterStage.tsx \
        frontend/src/dashboard/founders/section/components/incubation/HackathonPanel.tsx
git commit -m "feat(hackathon): 5-stage pipeline shell + StagePill + PR-C empty states"
```

---

## Task 6: DiscoverStage + RegisteredTeamCard + Manage Team drawer

**Files:**
- Modify: `frontend/src/dashboard/founders/section/components/incubation/hackathon/DiscoverStage.tsx` (replace stub)
- Create: `frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisteredTeamCard.tsx`

**Goal:** The Discover stage shows different content based on whether the founder has registrations: a hero + grid of mocked hackathons when none, or a list of `RegisteredTeamCard`s + an "other open hackathons" section when ≥1. The Manage Team drawer is part of `RegisteredTeamCard` (slides from the right).

- [ ] **Step 1: Create RegisteredTeamCard.tsx**

Write `frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisteredTeamCard.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Copy, Check, X, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import type { HackathonRegistration } from "@/contexts/UserContext";
import { useFounderProfile } from "@/contexts/UserContext";

interface Props {
  registration: HackathonRegistration;
  hackathon: Hackathon;
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function inviteUrl(reg: HackathonRegistration): string {
  return `https://techit.ai/h/${reg.hackathonId}/team/${reg.teamId}?token=${reg.inviteToken}`;
}

export function RegisteredTeamCard({ registration, hackathon }: Props) {
  const navigate = useNavigate();
  const { updateHackathonRegistration } = useFounderProfile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const days = daysUntil(hackathon.startDate);
  const memberCount = registration.members.length + 1; // +1 for the leader
  const teamSize = memberCount + registration.openRoles.length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl(registration));
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleRoster = () => {
    updateHackathonRegistration(registration.teamId, {
      rosterClosed: !registration.rosterClosed,
    });
    toast.success(registration.rosterClosed ? "Roster reopened" : "Roster closed");
  };

  return (
    <>
      <div className="border border-slate-200 rounded-xl p-5 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden="true">{hackathon.poster}</span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{hackathon.title}</p>
              <h3 className="text-base font-semibold text-slate-900 truncate">{registration.teamName}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-600 mt-1.5">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{memberCount} of {teamSize}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Starts in {days} days</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Manage team →
          </button>
          <button
            type="button"
            onClick={() => navigate(`/matches?hackathon=${registration.hackathonId}`)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Find collaborators →
          </button>
          <button
            type="button"
            disabled
            title="Submit brief — coming in PR-C"
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed"
          >
            Submit brief — coming in PR-C
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-slate-900/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto" role="dialog" aria-label="Manage team">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Manage team</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{hackathon.title}</p>
                <h3 className="text-lg font-semibold text-slate-900">{registration.teamName}</h3>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-2">Members ({memberCount} of {teamSize})</p>
                <ul className="space-y-2">
                  <li className="flex items-center justify-between text-sm border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-slate-900">You · Leader</span>
                  </li>
                  {registration.members.map((m) => (
                    <li key={m.collaboratorId} className="flex items-center justify-between text-sm border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-slate-900">{m.name} · {m.role}</span>
                    </li>
                  ))}
                  {registration.openRoles.map((r) => (
                    <li key={r} className="flex items-center justify-between text-sm border border-dashed border-slate-300 rounded-lg px-3 py-2 text-slate-500">
                      <span>Open: {r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-2">Invite link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl(registration)}
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 font-mono truncate"
                    aria-label="Invite link"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleToggleRoster}
                  className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  {registration.rosterClosed ? "Reopen roster" : "Close roster"}
                </button>
                <p className="text-xs text-slate-500 mt-1.5">
                  {registration.rosterClosed
                    ? "Roster is closed. Invite link shows 'team is full' to visitors."
                    : "Closing the roster prevents new members from joining via the invite link."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Replace the DiscoverStage stub**

Overwrite `frontend/src/dashboard/founders/section/components/incubation/hackathon/DiscoverStage.tsx`:

```tsx
import { Link } from "react-router-dom";
import { useFounderProfile } from "@/contexts/UserContext";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import { OpportunityCard } from "@/dashboard/founders/section/components/founder/OpportunityCard";
import { RegisteredTeamCard } from "./RegisteredTeamCard";

function isHackathon(o: { type: string }): o is Hackathon {
  return o.type === "hackathon";
}

export function DiscoverStage() {
  const { founderProfile } = useFounderProfile();
  const registrations = founderProfile.hackathonRegistrations;
  const allHackathons = OPPORTUNITIES.filter(isHackathon);
  const registeredIds = new Set(registrations.map((r) => r.hackathonId));
  const otherHackathons = allHackathons.filter((h) => !registeredIds.has(h.id));

  if (registrations.length === 0) {
    return (
      <div className="space-y-6">
        <div className="border border-slate-200 rounded-xl p-6 bg-white">
          <h2 className="text-base font-semibold text-slate-900">Find a hackathon to join</h2>
          <p className="text-sm text-slate-600 mt-1">
            Pick a hackathon below to register your team, or browse the full Opportunity Hub.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            {allHackathons.map((h) => (
              <OpportunityCard key={h.id} opportunity={h} />
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <Link to="/opportunity-hub" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              Browse all opportunities →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Your teams</h2>
        <div className="space-y-3">
          {registrations.map((reg) => {
            const hackathon = allHackathons.find((h) => h.id === reg.hackathonId);
            if (!hackathon) return null;
            return <RegisteredTeamCard key={reg.teamId} registration={reg} hackathon={hackathon} />;
          })}
        </div>
      </div>
      {otherHackathons.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Other open hackathons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherHackathons.map((h) => (
              <OpportunityCard key={h.id} opportunity={h} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: `OpportunityCard` is imported from a path that doesn't exist yet — Task 8 creates it. Until then, `tsc` will report a missing-module error specific to this import. That's expected and resolves at the end of Task 8.

- [ ] **Step 3: Verify TypeScript compiles (with expected new errors)**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `32` or `33` (one or two new errors from the missing `OpportunityCard` import — `Cannot find module` and possibly a type error on the JSX). Note this number — it must drop back to `≤31` after Task 8.

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/incubation/hackathon/DiscoverStage.tsx \
        frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisteredTeamCard.tsx
git commit -m "feat(hackathon): DiscoverStage with registered-team cards + manage drawer"
```

The commit is intentional even with the temporary error — Task 8 closes the loop. Each task should commit so we have rollback granularity.

---

## Task 7: RegisterStage form + invite-link generation

**Files:**
- Modify: `frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisterStage.tsx` (replace stub)

**Goal:** A 3-step form (hackathon picker, team setup, confirm) that on submit calls `registerForHackathon` with a freshly-generated `teamId` and `inviteToken`, then renders a success card with the shareable URL and quick-share targets.

- [ ] **Step 1: Replace the RegisterStage stub**

Overwrite `frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisterStage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, Check, Mail, Send, ArrowLeft, Trophy } from "lucide-react";
import { toast } from "sonner";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import { useFounderProfile, type OpenRole } from "@/contexts/UserContext";

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += BASE32_ALPHABET[bytes[i] % 32];
  return out;
}

function isHackathon(o: { type: string }): o is Hackathon {
  return o.type === "hackathon";
}

export function RegisterStage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { founderProfile, registerForHackathon } = useFounderProfile();

  const allHackathons = useMemo(() => OPPORTUNITIES.filter(isHackathon), []);
  const initialHackathonId = searchParams.get("h") ?? "";
  const [hackathonId, setHackathonId] = useState(initialHackathonId);
  const hackathon = useMemo(
    () => allHackathons.find((h) => h.id === hackathonId),
    [allHackathons, hackathonId],
  );

  const [teamName, setTeamName] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [selectedRoles, setSelectedRoles] = useState<OpenRole[]>(founderProfile.openRoles);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{
    teamId: string;
    inviteToken: string;
    teamName: string;
    hackathonId: string;
  } | null>(null);

  if (!hackathon && !success) {
    return (
      <div className="border border-amber-200 bg-amber-50 rounded-xl p-5">
        <p className="text-sm text-amber-900">Pick a hackathon to register for.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {allHackathons.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHackathonId(h.id)}
              className="text-left border border-slate-200 rounded-lg p-3 bg-white hover:border-violet-300"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Hackathon</p>
              <p className="text-sm font-semibold text-slate-900">{h.title}</p>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{h.theme}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const toggleRole = (role: OpenRole) =>
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (teamName.trim().length < 3) e.teamName = "Team name must be at least 3 characters.";
    if (selectedRoles.length === 0) e.roles = "Select at least one role to fill.";
    if (teamSize < 2 || teamSize > 5) e.teamSize = "Team size must be between 2 and 5.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate() || !hackathon) return;
    const teamId = `team_${randomToken(6)}`;
    const inviteToken = randomToken(8);
    registerForHackathon({
      hackathonId: hackathon.id,
      teamId,
      teamName: teamName.trim(),
      role: "leader",
      inviteToken,
      registeredAt: new Date().toISOString(),
      members: [],
      openRoles: selectedRoles,
      stage: "registered",
    });
    setSuccess({ teamId, inviteToken, teamName: teamName.trim(), hackathonId: hackathon.id });
    toast.success("Registered for " + hackathon.title);
  };

  if (success) {
    return (
      <SuccessCard
        teamId={success.teamId}
        inviteToken={success.inviteToken}
        teamName={success.teamName}
        hackathonId={success.hackathonId}
        hackathonTitle={hackathon?.title ?? ""}
        onFindCollaborators={() => navigate(`/matches?hackathon=${success.hackathonId}`)}
      />
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-6 bg-white max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <Trophy className="w-5 h-5 text-violet-600" />
        <h2 className="text-base font-semibold text-slate-900">Register for {hackathon!.title}</h2>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">
            Team name
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="BrightBridge"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500"
          />
          {errors.teamName && <p className="text-xs text-rose-600 mt-1">{errors.teamName}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-2">
            Team size
          </label>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTeamSize(n)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border ${
                  teamSize === n
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {errors.teamSize && <p className="text-xs text-rose-600 mt-1">{errors.teamSize}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-2">
            Roles to fill ({selectedRoles.length} selected)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {founderProfile.openRoles.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="rounded text-violet-600 focus:ring-violet-500"
                />
                <span className="text-slate-700">{role}</span>
              </label>
            ))}
          </div>
          {errors.roles && <p className="text-xs text-rose-600 mt-1">{errors.roles}</p>}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
          <Link to="/incubation-hub?panel=hackathon" className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            className="text-xs font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
          >
            Confirm & generate invite link
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessCard({
  teamId,
  inviteToken,
  teamName,
  hackathonId,
  hackathonTitle,
  onFindCollaborators,
}: {
  teamId: string;
  inviteToken: string;
  teamName: string;
  hackathonId: string;
  hackathonTitle: string;
  onFindCollaborators: () => void;
}) {
  const url = `https://techit.ai/h/${hackathonId}/team/${teamId}?token=${inviteToken}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const mailto = `mailto:?subject=${encodeURIComponent(`Join ${teamName} for ${hackathonTitle}`)}&body=${encodeURIComponent(url)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`Join ${teamName} for ${hackathonTitle}: ${url}`)}`;

  return (
    <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-3">
        <Check className="w-5 h-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-emerald-900">You're registered as team leader for {hackathonTitle}</h2>
      </div>
      <p className="text-sm text-emerald-800 mb-4">Share this link with collaborators to invite them to {teamName}:</p>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          readOnly
          value={url}
          className="flex-1 text-xs border border-emerald-200 rounded-lg px-3 py-2 bg-white text-slate-700 font-mono truncate"
          aria-label="Invite link"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-medium px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={mailto} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 flex items-center gap-1">
          <Mail className="w-3.5 h-3.5" />
          Email
        </a>
        <a href={wa} target="_blank" rel="noreferrer noopener" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 flex items-center gap-1">
          <Send className="w-3.5 h-3.5" />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={onFindCollaborators}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-300 text-violet-700 bg-white hover:bg-violet-50"
        >
          Find Hackathon Collaborator →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: same count as end of Task 6 (`32` or `33`). The `OpportunityCard` import inside DiscoverStage is still missing; Task 8 fixes it.

- [ ] **Step 3: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisterStage.tsx
git commit -m "feat(hackathon): RegisterStage form with invite-link generation"
```

---

## Task 8: OpportunityCard + OpportunityHub page

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/founder/OpportunityCard.tsx`
- Create: `frontend/src/dashboard/founders/section/components/founder/OpportunityHub.tsx`
- Modify: `frontend/src/App.tsx` (add the route)
- Modify: `frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx` (enable the sidebar entry)

**Goal:** The `OpportunityHub` page at `/opportunity-hub` with featured + grid layout, four type filter pills, status dropdown, and search. The `OpportunityCard` component is type-aware via discriminated union — same component handles all four types.

- [ ] **Step 1: Create OpportunityCard.tsx**

Write `frontend/src/dashboard/founders/section/components/founder/OpportunityCard.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import type { Opportunity } from "@/dashboard/_shared/opportunities/types";

interface Props {
  opportunity: Opportunity;
  variant?: "featured" | "grid";
}

const TYPE_LABEL: Record<Opportunity["type"], string> = {
  hackathon: "HACKATHON",
  program: "PROGRAM",
  funding: "FUNDING",
  event: "EVENT",
};

const STATUS_STYLES = {
  open: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Open" },
  "closing-soon": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Closing soon" },
  closed: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: "Closed" },
};

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - new Date().getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function countdown(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `Closes in ${days} days`;
}

function metricLine(opp: Opportunity): string {
  switch (opp.type) {
    case "hackathon":
      return `${opp.prizePool} · ${opp.durationHours}h · ${opp.registrants.toLocaleString()} registered`;
    case "program":
      return `${opp.format} · ${opp.durationWeeks} weeks · Cohort ${opp.cohortSize}`;
    case "funding":
      return `${opp.amountRange} · ${opp.equityRequired ? "Equity" : "Non-dilutive"}`;
    case "event":
      return `${opp.format} · ${opp.durationMinutes}min · ${opp.isVirtual ? "Virtual" : opp.hostedBy}`;
  }
}

function ctaLabel(opp: Opportunity): string {
  switch (opp.type) {
    case "hackathon": return "Register team →";
    case "program":
    case "funding":   return "Apply →";
    case "event":     return "RSVP →";
  }
}

function ctaTarget(opp: Opportunity): string {
  if (opp.type === "hackathon") {
    return `/incubation-hub?panel=hackathon&h=${opp.id}&stage=register`;
  }
  return `/opportunity-hub/${opp.id}`;
}

export function OpportunityCard({ opportunity, variant = "grid" }: Props) {
  const navigate = useNavigate();
  const status = STATUS_STYLES[opportunity.status];
  const isFeatured = variant === "featured";

  return (
    <article
      className={`border border-slate-200 rounded-xl bg-white overflow-hidden flex flex-col ${
        isFeatured ? "h-full" : ""
      }`}
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="text-3xl shrink-0" aria-hidden="true">{opportunity.poster}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {TYPE_LABEL[opportunity.type]}
          </span>
        </div>
        <h3 className={`font-semibold text-slate-900 ${isFeatured ? "text-xl" : "text-base"} mb-1`}>
          {opportunity.title}
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          {opportunity.organizer.logoEmoji && <span className="mr-1">{opportunity.organizer.logoEmoji}</span>}
          {opportunity.organizer.name}
        </p>
        <p className={`text-sm text-slate-600 mb-4 ${isFeatured ? "" : "line-clamp-2"}`}>
          {opportunity.summary}
        </p>
        <p className="text-xs text-slate-500 mb-4 font-medium">{metricLine(opportunity)}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded border ${status.bg} ${status.text} ${status.border} font-medium`}>
              {status.label}
            </span>
            <span className="text-slate-500">{countdown(opportunity.applyDeadline)}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate(ctaTarget(opportunity))}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
          >
            {ctaLabel(opportunity)}
          </button>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Create OpportunityHub.tsx**

Write `frontend/src/dashboard/founders/section/components/founder/OpportunityHub.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Opportunity, OpportunityType, OpportunityStatus } from "@/dashboard/_shared/opportunities/types";
import { OpportunityCard } from "./OpportunityCard";

type TypeFilter = "all" | OpportunityType;
type StatusFilter = "all" | OpportunityStatus;

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  hackathon: "Hackathons",
  program: "Programs",
  funding: "Funding",
  event: "Events",
};

const STATUS_RANK: Record<OpportunityStatus, number> = { open: 0, "closing-soon": 1, closed: 2 };

export default function OpportunityHub() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OPPORTUNITIES
      .filter((o) => typeFilter === "all" || o.type === typeFilter)
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => {
        if (!q) return true;
        return (
          o.title.toLowerCase().includes(q) ||
          o.organizer.name.toLowerCase().includes(q) ||
          o.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (r !== 0) return r;
        return new Date(a.applyDeadline).getTime() - new Date(b.applyDeadline).getTime();
      });
  }, [typeFilter, statusFilter, search]);

  const featured = useMemo(() => {
    return filtered.find((o) => o.featured && o.status === "open") ?? filtered.find((o) => o.status === "open") ?? filtered[0] ?? null;
  }, [filtered]);

  const gridItems = useMemo(() => filtered.filter((o) => o.id !== featured?.id), [filtered, featured]);

  const counts = useMemo(() => {
    const c: Record<TypeFilter, number> = { all: 0, hackathon: 0, program: 0, funding: 0, event: 0 };
    for (const o of OPPORTUNITIES) {
      if (statusFilter !== "all" && o.status !== statusFilter) continue;
      c.all++;
      c[o.type]++;
    }
    return c;
  }, [statusFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Opportunity Hub</h1>
        <p className="text-sm text-slate-600 mt-1">Programs, hackathons, funding, and events from organizations.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                typeFilter === t
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {TYPE_LABELS[t]} ({counts[t]})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-xs px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700"
            aria-label="Status filter"
          >
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="closing-soon">Closing soon</option>
            <option value="closed">Closed</option>
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white"
              aria-label="Search opportunities"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-600">
            {OPPORTUNITIES.length === 0
              ? "Organizations haven't published any opportunities yet."
              : `No ${typeFilter === "all" ? "" : TYPE_LABELS[typeFilter].toLowerCase() + " "}opportunities match. Try a different filter.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {featured && (
            <div className="lg:col-span-3">
              <OpportunityCard opportunity={featured} variant="featured" />
            </div>
          )}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {gridItems.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} variant="grid" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the route to App.tsx**

In `frontend/src/App.tsx`, near line 26 (after `import MatchResults from ...`), add:

```tsx
import OpportunityHub from "@/dashboard/founders/section/components/founder/OpportunityHub";
```

Inside the `<Route element={<FounderLayout />}>` block (around lines 172-179), add a new route after `/matches`:

```tsx
          <Route path="/opportunity-hub"   element={<OpportunityHub />} />
```

- [ ] **Step 4: Enable the sidebar entry**

In `frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx`:

1. Update the lucide import line (line 5) to include `Compass`:
   ```ts
   import {
     LayoutDashboard, FlaskConical, PanelsTopLeft, Rss, Compass, Lightbulb,
     Route as RouteIcon, MessageSquare, LineChart, Wallet, UserCircle,
     Settings as SettingsIcon, ArrowLeft,
   } from "lucide-react";
   ```
   (Drops `Sparkles` from the import — it's no longer used after this task.)

2. Move Opportunity Hub OUT of `comingSoonNav` and INTO `primaryNav`. Replace lines 17-26:

```tsx
const primaryNav: NavItem[] = [
  { name: "Dashboard",       path: "/dashboard",       icon: LayoutDashboard, kind: "link" },
  { name: "Incubation Hub",  path: "/incubation-hub",  icon: FlaskConical,    kind: "link" },
  { name: "Opportunity Hub", path: "/opportunity-hub", icon: Compass,         kind: "link" },
  { name: "Workspaces",      path: "/workspaces",      icon: PanelsTopLeft,   kind: "link" },
  { name: "Feed",            path: "/feed",            icon: Rss,             kind: "external" },
];

const comingSoonNav: NavItem[] = [
  { name: "Idea Hub",       path: "#", icon: Lightbulb, kind: "placeholder" },
  { name: "Market Pathway", path: "#", icon: RouteIcon, kind: "placeholder" },
];
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31`. (The `OpportunityCard` import inside `DiscoverStage.tsx` from Task 6 — left as a TODO comment — should now be filled in. **Open `DiscoverStage.tsx` and add `import { OpportunityCard } from "@/dashboard/founders/section/components/founder/OpportunityCard";` at the top, then replace any `// TODO: OpportunityCard` placeholder with the real `<OpportunityCard opportunity={h} />`.**)

- [ ] **Step 6: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/OpportunityCard.tsx \
        frontend/src/dashboard/founders/section/components/founder/OpportunityHub.tsx \
        frontend/src/App.tsx \
        frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx \
        frontend/src/dashboard/founders/section/components/incubation/hackathon/DiscoverStage.tsx
git commit -m "feat(opportunity): hub page + unified OpportunityCard + sidebar entry enabled"
```

---

## Task 9: OpportunityDetail page

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/founder/OpportunityDetail.tsx`
- Modify: `frontend/src/App.tsx` (add the route)

**Goal:** A detail page at `/opportunity-hub/:opportunityId`. Hackathon detail focus: full opportunity card expanded + a `Register team` CTA that routes into the Hackathon Panel's Register stage. Other types (program, funding, event): generic detail card with key fields + inert apply CTA + footer note.

- [ ] **Step 1: Create OpportunityDetail.tsx**

Write `frontend/src/dashboard/founders/section/components/founder/OpportunityDetail.tsx`:

```tsx
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Opportunity } from "@/dashboard/_shared/opportunities/types";

const TYPE_LABEL: Record<Opportunity["type"], string> = {
  hackathon: "HACKATHON",
  program: "PROGRAM",
  funding: "FUNDING",
  event: "EVENT",
};

export default function OpportunityDetail() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const navigate = useNavigate();
  const opp = OPPORTUNITIES.find((o) => o.id === opportunityId);

  if (!opp) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-16 border border-slate-200 rounded-xl bg-white">
          <p className="text-base text-slate-700 font-medium">Opportunity not found</p>
          <p className="text-sm text-slate-500 mt-1">The opportunity may have been removed or never existed.</p>
          <Link to="/opportunity-hub" className="inline-block mt-4 text-sm font-medium text-violet-700 hover:underline">
            ← Back to Opportunity Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/opportunity-hub"
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Opportunity Hub
        </Link>

        <div className="border border-slate-200 rounded-xl bg-white p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <span className="text-5xl shrink-0" aria-hidden="true">{opp.poster}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              {TYPE_LABEL[opp.type]}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{opp.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {opp.organizer.logoEmoji && <span className="mr-1">{opp.organizer.logoEmoji}</span>}
            {opp.organizer.name}
          </p>
          <p className="text-base text-slate-700 mt-4">{opp.summary}</p>

          {opp.type === "hackathon" && (
            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Detail label="Theme" value={opp.theme} />
              <Detail label="Prize Pool" value={opp.prizePool} />
              <Detail label="Duration" value={`${opp.durationHours} hours`} />
              <Detail label="Dates" value={`${opp.startDate} → ${opp.endDate}`} />
              <Detail label="Registrants" value={opp.registrants.toLocaleString()} />
              <Detail label="Teams formed" value={opp.teamsFormed.toString()} />
              <Detail label="Partners" value={opp.partners.join(", ")} />
            </dl>
          )}
          {opp.type === "program" && (
            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Detail label="Format" value={opp.format} />
              <Detail label="Duration" value={`${opp.durationWeeks} weeks`} />
              <Detail label="Cohort size" value={opp.cohortSize.toString()} />
              <Detail label="Starts" value={opp.startDate} />
              <Detail label="Perks" value={opp.perks.join(", ")} />
            </dl>
          )}
          {opp.type === "funding" && (
            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Detail label="Format" value={opp.format} />
              <Detail label="Amount" value={opp.amountRange} />
              <Detail label="Equity required" value={opp.equityRequired ? "Yes" : "No"} />
              <Detail label="Stages eligible" value={opp.audienceStage.join(", ")} />
            </dl>
          )}
          {opp.type === "event" && (
            <dl className="grid grid-cols-2 gap-4 mt-6">
              <Detail label="Format" value={opp.format} />
              <Detail label="Starts" value={opp.startDate} />
              <Detail label="Duration" value={`${opp.durationMinutes} min`} />
              <Detail label="Hosted by" value={opp.hostedBy} />
              <Detail label="Mode" value={opp.isVirtual ? "Virtual" : "In person"} />
            </dl>
          )}

          <div className="flex flex-wrap gap-2 mt-6">
            {opp.tags.map((t) => (
              <span key={t} className="text-[11px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Apply by {opp.applyDeadline}</span>
            {opp.type === "hackathon" ? (
              <button
                type="button"
                onClick={() => navigate(`/incubation-hub?panel=hackathon&h=${opp.id}&stage=register`)}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              >
                Register team →
              </button>
            ) : (
              <div className="text-right">
                <button
                  type="button"
                  disabled
                  className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed"
                >
                  {opp.type === "event" ? "RSVP" : "Apply"} →
                </button>
                <p className="text-[11px] text-slate-500 mt-1">Application flow coming soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</dt>
      <dd className="text-sm text-slate-900 mt-0.5">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Wire the route in App.tsx**

In `frontend/src/App.tsx`:

1. Add the import near the other Founder-side page imports:
   ```tsx
   import OpportunityDetail from "@/dashboard/founders/section/components/founder/OpportunityDetail";
   ```
2. Inside the `<Route element={<FounderLayout />}>` block, add the route under the hub:
   ```tsx
   <Route path="/opportunity-hub/:opportunityId" element={<OpportunityDetail />} />
   ```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31`.

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/OpportunityDetail.tsx frontend/src/App.tsx
git commit -m "feat(opportunity): detail page with type-specific fields and CTA routing"
```

---

## Task 10: InviteAcceptPage with all 8 lookup-state branches

**Files:**
- Create: `frontend/src/dashboard/founders/section/components/founder/InviteAcceptPage.tsx`
- Modify: `frontend/src/App.tsx` (add the route)

**Goal:** The page at `/h/:hackathonId/team/:teamId?token=<8-char>` that handles all 8 lookup states from the spec, renders the team preview when valid, and writes a synthetic `Sample Collaborator` member when the visitor clicks Join. Identity caveat: PR-B unauthenticated mocks mean the visitor IS the same FounderProfile — synthetic member is documented behavior, not a bug.

- [ ] **Step 1: Create InviteAcceptPage.tsx**

Write `frontend/src/dashboard/founders/section/components/founder/InviteAcceptPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useFounderProfile } from "@/contexts/UserContext";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";

type InviteState =
  | { kind: "ok"; hackathon: Hackathon; teamName: string; leaderName: string; openRoles: string[]; memberCount: number; teamSize: number }
  | { kind: "leader"; hackathonId: string; teamId: string; inviteToken: string }
  | { kind: "token-mismatch" }
  | { kind: "not-found" }
  | { kind: "team-full"; hackathonId: string }
  | { kind: "roster-closed" }
  | { kind: "hackathon-missing" };

export default function InviteAcceptPage() {
  const { hackathonId, teamId } = useParams<{ hackathonId: string; teamId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { founderProfile, addHackathonMember } = useFounderProfile();

  const state = useMemo<InviteState>(() => {
    if (!hackathonId || !teamId) return { kind: "not-found" };
    const hackathon = OPPORTUNITIES.find(
      (o): o is Hackathon => o.type === "hackathon" && o.id === hackathonId,
    );
    const reg = founderProfile.hackathonRegistrations.find(
      (r) => r.hackathonId === hackathonId && r.teamId === teamId,
    );
    if (!reg) return { kind: "not-found" };
    if (!hackathon) return { kind: "hackathon-missing" };
    if (reg.inviteToken !== token) return { kind: "token-mismatch" };
    if (reg.role === "leader") {
      return { kind: "leader", hackathonId, teamId, inviteToken: reg.inviteToken };
    }
    if (reg.rosterClosed) return { kind: "roster-closed" };
    const memberCount = reg.members.length + 1;
    const teamSize = memberCount + reg.openRoles.length;
    if (memberCount >= teamSize) return { kind: "team-full", hackathonId };
    return {
      kind: "ok",
      hackathon,
      teamName: reg.teamName,
      leaderName: founderProfile.name,
      openRoles: reg.openRoles,
      memberCount,
      teamSize,
    };
  }, [hackathonId, teamId, token, founderProfile.hackathonRegistrations, founderProfile.name]);

  // The leader branch: render a small variant. Same outer chrome as the rest.
  if (state.kind === "leader") {
    const url = `https://techit.ai/h/${state.hackathonId}/team/${state.teamId}?token=${state.inviteToken}`;
    return (
      <Wrapper>
        <h1 className="text-xl font-semibold text-slate-900">You're the leader of this team</h1>
        <p className="text-sm text-slate-600 mt-2">
          Share this invite link with collaborators instead of clicking it yourself.
        </p>
        <div className="flex items-center gap-2 mt-4">
          <input readOnly value={url} className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700" />
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(url); toast.success("Invite link copied"); }}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
        </div>
        <Link to="/incubation-hub?panel=hackathon" className="inline-block mt-6 text-sm font-medium text-violet-700 hover:underline">
          ← Back to your hackathon panel
        </Link>
      </Wrapper>
    );
  }

  if (state.kind === "ok") {
    return <AcceptForm state={state} hackathonId={hackathonId!} teamId={teamId!} addHackathonMember={addHackathonMember} navigate={navigate} />;
  }

  // All other branches render a uniform error card.
  const messages: Record<Exclude<InviteState["kind"], "ok" | "leader">, { title: string; body: React.ReactNode }> = {
    "token-mismatch":     { title: "This invite link is invalid or has expired.", body: <BackLink to="/opportunity-hub" /> },
    "not-found":          { title: "We can't find that team.", body: <p className="text-sm text-slate-600 mt-2">The invite link may be from a hackathon you're not signed in for. <BackLink to="/opportunity-hub" /></p> },
    "team-full":          { title: "This team is already full.", body: <Link to={`/opportunity-hub/${(state as { hackathonId: string }).hackathonId}`} className="inline-block mt-4 text-sm font-medium text-violet-700 hover:underline">Find another team in the hackathon →</Link> },
    "roster-closed":      { title: "This team's roster is closed.", body: <BackLink to="/opportunity-hub" /> },
    "hackathon-missing":  { title: "This hackathon is no longer available.", body: <BackLink to="/opportunity-hub" /> },
  };
  const m = messages[state.kind];
  return (
    <Wrapper>
      <h1 className="text-xl font-semibold text-slate-900">{m.title}</h1>
      {m.body}
    </Wrapper>
  );
}

function AcceptForm({
  state,
  hackathonId,
  teamId,
  addHackathonMember,
  navigate,
}: {
  state: Extract<InviteState, { kind: "ok" }>;
  hackathonId: string;
  teamId: string;
  addHackathonMember: (teamId: string, m: { collaboratorId: string; name: string; role: string; acceptedAt: string }) => void;
  navigate: (path: string) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<string>(state.openRoles[0] ?? "");
  const handleJoin = () => {
    addHackathonMember(teamId, {
      collaboratorId: "mock_self",
      name: "Sample Collaborator",
      role: selectedRole,
      acceptedAt: new Date().toISOString(),
    });
    toast.success(`Joined ${state.teamName} for ${state.hackathon.title}.`);
    navigate("/incubation-hub?panel=hackathon");
  };
  const handleDecline = () => {
    toast.info("Invite declined.");
    navigate("/opportunity-hub");
  };
  return (
    <Wrapper>
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">You're invited to join</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-3xl" aria-hidden="true">{state.hackathon.poster}</span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{state.hackathon.title}</h1>
          <p className="text-xs text-slate-500">{state.hackathon.organizer.name} · {state.hackathon.startDate} → {state.hackathon.endDate}</p>
        </div>
      </div>
      <hr className="my-5 border-slate-200" />
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Team</p>
      <h2 className="text-base font-semibold text-slate-900 mt-1">{state.teamName}</h2>
      <p className="text-xs text-slate-500 mt-0.5">Led by {state.leaderName}</p>
      <p className="text-xs text-slate-500 mt-3 font-medium uppercase tracking-wider">
        Members ({state.memberCount} of {state.teamSize}) · {state.openRoles.length} role{state.openRoles.length === 1 ? "" : "s"} open
      </p>
      <ul className="mt-2 space-y-1.5">
        {state.openRoles.map((r) => (
          <li key={r} className="text-sm text-slate-700 border border-dashed border-slate-200 rounded-lg px-3 py-2">○ {r}</li>
        ))}
      </ul>
      <hr className="my-5 border-slate-200" />
      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">Choose your role</label>
      <select
        value={selectedRole}
        onChange={(e) => setSelectedRole(e.target.value)}
        disabled={state.openRoles.length === 1}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
      >
        {state.openRoles.map((r) => (<option key={r} value={r}>{r}</option>))}
      </select>
      <div className="flex items-center justify-between gap-3 mt-6">
        <button type="button" onClick={handleDecline} className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
          Decline
        </button>
        <button type="button" onClick={handleJoin} className="text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
          Join team & continue →
        </button>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6">
      <div className="max-w-xl mx-auto">
        <Link to="/opportunity-hub" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Opportunity Hub
        </Link>
        <div className="border border-slate-200 rounded-xl bg-white p-6">{children}</div>
      </div>
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-block mt-4 text-sm font-medium text-violet-700 hover:underline">
      ← Back to Opportunity Hub
    </Link>
  );
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`:
1. Add the import:
   ```tsx
   import InviteAcceptPage from "@/dashboard/founders/section/components/founder/InviteAcceptPage";
   ```
2. Inside the `<Route element={<FounderLayout />}>` block, add:
   ```tsx
   <Route path="/h/:hackathonId/team/:teamId" element={<InviteAcceptPage />} />
   ```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31`.

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/InviteAcceptPage.tsx frontend/src/App.tsx
git commit -m "feat(invite): accept page with all 8 lookup branches and synthetic Sample Collaborator"
```

---

## Task 11: /matches integration with `?hackathon=<id>` filtering

**Files:**
- Modify: `frontend/src/dashboard/matchResults.tsx`
- Create: `frontend/src/dashboard/founders/section/components/founder/HackathonMatchBanner.tsx`

**Goal:** Add hackathon-aware behavior to the existing `/matches` page via a single query param, isolated in a sibling banner component to avoid further inflating the 552-line `matchResults.tsx`. Filtered list, primary CTA changes, success toast, "Invited" greyed state.

**Note on filtering:** The existing `Match.role` field is a free-form string (`"Full-Stack Developer"`, `"Product Designer"`, etc.) and `OpenRole` is a union of structured labels (`"Frontend Engineer"`, `"Designer (Product)"`, etc.). The mock filter is permissive: a `Match` is included if any word in its `role` (case-insensitive, split on space/parens) appears in any of the registration's `openRoles`. This is intentionally loose for PR-B mocks; PR-D will replace with structured matching.

- [ ] **Step 1: Create HackathonMatchBanner.tsx**

Write `frontend/src/dashboard/founders/section/components/founder/HackathonMatchBanner.tsx`:

```tsx
import { Link } from "react-router-dom";
import { Trophy, X } from "lucide-react";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";

interface Props {
  hackathon: Hackathon | null;
  teamName: string | null;
}

export function HackathonMatchBanner({ hackathon, teamName }: Props) {
  if (!hackathon) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Trophy className="w-4 h-4" /> Filtering for an unknown hackathon
          </p>
          <p className="text-xs mt-1">
            We can't find that hackathon, but you can still browse all collaborators below.
          </p>
        </div>
        <Link to="/matches" aria-label="Clear filter" className="p-1 rounded hover:bg-amber-100">
          <X className="w-4 h-4" />
        </Link>
      </div>
    );
  }
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Trophy className="w-4 h-4" /> Filtering for {hackathon.title}
        </p>
        <p className="text-xs mt-1">
          Showing collaborators available {hackathon.startDate}–{hackathon.endDate}
          {teamName ? `, in roles you listed for team ${teamName}` : ""}.
        </p>
      </div>
      <Link to="/matches" className="text-xs font-medium px-2 py-1 rounded border border-amber-300 hover:bg-amber-100 inline-flex items-center gap-1 shrink-0">
        Clear filter <X className="w-3 h-3" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Modify `frontend/src/dashboard/matchResults.tsx` — read query param**

Near the top of the `MatchResults` function body (line 73 onward), add:

```tsx
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useFounderProfile } from "@/contexts/UserContext";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import { HackathonMatchBanner } from "@/dashboard/founders/section/components/founder/HackathonMatchBanner";
```

Inside the component:

```tsx
const [searchParams] = useSearchParams();
const hackathonId = searchParams.get("hackathon");
const { founderProfile, addHackathonMember } = useFounderProfile();

const hackathon: Hackathon | null = hackathonId
  ? (OPPORTUNITIES.find((o): o is Hackathon => o.type === "hackathon" && o.id === hackathonId) ?? null)
  : null;

const registration = hackathonId
  ? founderProfile.hackathonRegistrations.find((r) => r.hackathonId === hackathonId) ?? null
  : null;

const [invitedNames, setInvitedNames] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Modify the matches list rendering — apply filter + change CTA**

Above the existing matches grid/list, render the banner if `hackathonId` is present:

```tsx
{hackathonId && <HackathonMatchBanner hackathon={hackathon} teamName={registration?.teamName ?? null} />}
```

Filter the matches array:

```tsx
const visibleMatches = useMemo(() => {
  if (!hackathonId || !registration) return matches;
  const openRoleWords = new Set(
    registration.openRoles.flatMap((r) => r.toLowerCase().split(/[\s()/]+/).filter(Boolean)),
  );
  return matches.filter((m) => {
    const matchWords = m.role.toLowerCase().split(/[\s()/]+/).filter(Boolean);
    return matchWords.some((w) => openRoleWords.has(w));
  });
}, [hackathonId, registration]);
```

Replace existing `matches.map(...)` with `visibleMatches.map(...)`.

For the primary CTA on each card (the existing "Connect" button — find it in the card render block), branch by `hackathonId`:

```tsx
{hackathonId && registration ? (
  invitedNames.has(match.name) ? (
    <button
      type="button"
      disabled
      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed flex items-center gap-1"
    >
      ✓ Invited
    </button>
  ) : (
    <button
      type="button"
      onClick={() => {
        const role = registration.openRoles[0]; // PR-B: pick first open role
        if (!role) return;
        addHackathonMember(registration.teamId, {
          collaboratorId: `mock_${match.name.replace(/\s+/g, "_").toLowerCase()}`,
          name: match.name,
          role,
          acceptedAt: new Date().toISOString(),
        });
        setInvitedNames((s) => new Set(s).add(match.name));
        toast.success(`Invited ${match.name} to ${registration.teamName}`);
      }}
      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
    >
      Invite to {registration.teamName}
    </button>
  )
) : (
  // existing "Connect" button — leave unchanged
)}
```

- [ ] **Step 4: Empty state for filtered list**

If `hackathonId` present and `visibleMatches.length === 0`:

```tsx
{hackathonId && visibleMatches.length === 0 && (
  <div className="border border-slate-200 rounded-xl bg-white p-8 text-center">
    <p className="text-sm text-slate-700 font-medium">No collaborators match the open roles for this hackathon.</p>
    <p className="text-xs text-slate-500 mt-1">Try widening your role list or sharing the invite link directly.</p>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `31`. The matchResults.tsx file already has its share of pre-existing errors — no new ones introduced.

- [ ] **Step 6: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/HackathonMatchBanner.tsx \
        frontend/src/dashboard/matchResults.tsx
git commit -m "feat(matches): ?hackathon filter banner + Invite CTA + Sample Collaborator member"
```

---

## Task 12: Dashboard wire-up + final tone audit

**Files:**
- Modify: `frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx` (Hackathon Momentum card)

**Goal:** The dashboard's Hackathon Momentum card becomes data-aware: empty state CTA active when no registrations, list view when ≥1. Final tone-audit grep across all PR-B files.

- [ ] **Step 1: Update the Hackathon Momentum card**

Open `Dashboard.tsx`. The card is currently at lines 254-275. Replace the entire card block with:

```tsx
{(() => {
  const regs = founderProfile.hackathonRegistrations;
  if (regs.length === 0) {
    return (
      <div className="border border-slate-200 bg-white rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-slate-700">Hackathon Momentum</h2>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600">
              No active hackathons. Join a hackathon from the Opportunity Hub to see your team's momentum
              tracker here — 4-hour check-ins, build velocity, blockers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/opportunity-hub")}
            className="text-xs font-medium text-violet-700 px-3 py-1.5 rounded-lg border border-violet-200 hover:bg-violet-50 flex items-center gap-2 shrink-0"
          >
            Browse opportunities →
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="border border-slate-200 bg-white rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Hackathon Momentum</h2>
        <TrendingUp className="w-4 h-4 text-slate-400" />
      </div>
      <ul className="space-y-3">
        {regs.map((r) => {
          const h = OPPORTUNITIES.find((o): o is Hackathon => o.type === "hackathon" && o.id === r.hackathonId);
          if (!h) return null;
          const memberCount = r.members.length + 1;
          const teamSize = memberCount + r.openRoles.length;
          const startMs = new Date(h.startDate).getTime() - Date.now();
          const days = Math.max(0, Math.ceil(startMs / (1000 * 60 * 60 * 24)));
          const startsLabel = days <= 7 ? `Starts in ${days} days` : `Starts ${h.startDate}`;
          return (
            <li key={r.teamId} className="flex items-start gap-3 border border-slate-100 rounded-lg p-3">
              <span className="text-xl shrink-0" aria-hidden="true">{h.poster}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{h.title}</p>
                <p className="text-xs text-slate-500">
                  {r.teamName} · {memberCount} of {teamSize} members · {startsLabel}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Stage: <span className="text-slate-700 font-medium">Registered</span> ──○────── Submit brief next
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/incubation-hub?panel=hackathon")}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0"
              >
                Manage team →
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => navigate("/opportunity-hub")}
        className="mt-4 text-xs font-medium text-violet-700 hover:underline"
      >
        Browse more opportunities →
      </button>
    </div>
  );
})()}
```

Required imports to add at the top of `Dashboard.tsx` (only the new ones — keep all existing):

```tsx
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
```

`useNavigate` is already imported and `navigate` already declared in the component — reuse it.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

Expected: `≤31`.

- [ ] **Step 3: Run the tone audit**

```bash
cd /home/faithsax/techIT/frontend/src
grep -rnE "animate-pulse|bg-gradient-to-(r|br)|from-violet-500|from-cyan|from-teal|from-rose|Demo User|🧠|🚨|💡|🤖|AI Insights|AI Score|AI Verified" \
  dashboard/_shared/opportunities \
  dashboard/founders/section/components/incubation \
  dashboard/founders/section/components/founder/OpportunityHub.tsx \
  dashboard/founders/section/components/founder/OpportunityCard.tsx \
  dashboard/founders/section/components/founder/OpportunityDetail.tsx \
  dashboard/founders/section/components/founder/InviteAcceptPage.tsx \
  dashboard/founders/section/components/founder/HackathonMatchBanner.tsx \
  | grep -vE "logoEmoji|poster"
```

Expected output: empty (no matches). If any line returns, fix the offending file before continuing.

The `🧠` emoji is allowed in `MainIncubationPanel.tsx` because that's the verbatim-moved existing content — pre-existing, not new in PR-B. The grep above does NOT scan `MainIncubationPanel.tsx`, only the new files.

- [ ] **Step 4: Run ESLint on the new files**

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/eslint/bin/eslint.js \
  src/dashboard/_shared/opportunities \
  src/dashboard/founders/section/components/incubation \
  src/dashboard/founders/section/components/founder/OpportunityHub.tsx \
  src/dashboard/founders/section/components/founder/OpportunityCard.tsx \
  src/dashboard/founders/section/components/founder/OpportunityDetail.tsx \
  src/dashboard/founders/section/components/founder/InviteAcceptPage.tsx \
  src/dashboard/founders/section/components/founder/HackathonMatchBanner.tsx
```

Expected: clean. Common failures and fixes:
- `react-hooks/purity` — wrap `Date.now()` / `new Date().getTime()` in `useMemo` if used in render bodies. Inside event handlers, they're allowed.
- Unused imports — remove them.
- Missing `key` props on lists — add the `key={item.id}` (or analogous unique field).

- [ ] **Step 5: Manual smoke test (user runs)**

The user runs the dev server natively (not WSL — `npm run dev` doesn't bind reliably from WSL). Pause and ask the user to verify:

1. `/dashboard` — empty Hackathon Momentum card with active "Browse opportunities →" CTA.
2. Click `Browse opportunities →` → lands on `/opportunity-hub` with featured + grid.
3. Filter pills and search box work; status dropdown defaults to "Open".
4. Click a hackathon card → routes to `/incubation-hub?panel=hackathon&h=<id>&stage=register`. The Hackathon panel is selected, Register stage is open, hackathon pre-picked.
5. Fill the registration form (team name, size, ≥1 role) → success card with invite link.
6. Click "Find Hackathon Collaborator →" → `/matches?hackathon=<id>` with amber banner, filtered cards, "Invite to {team}" CTA.
7. Click `Invite to {team}` on a card → toast, card greys to "Invited".
8. Back to dashboard → Hackathon Momentum card is now in list view, "Manage team" routes to the panel.
9. Open the invite link in a new tab → InviteAcceptPage shows "You're the leader of this team — share the link" (because the visitor IS the leader in single-user mock).
10. Manually edit the URL `?token=` to a wrong value → "This invite link is invalid or has expired."
11. Tone audit visually: no purple gradients, no pulse animations, no 🧠 in headings, no "Demo User."

- [ ] **Step 6: Commit**

```bash
cd /home/faithsax/techIT
git add frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx
git commit -m "feat(dashboard): data-aware Hackathon Momentum card with team list"
```

---

## End-of-plan checklist

- [ ] Final `tsc` count ≤ 31 across all 12 commits.
- [ ] Tone audit clean on PR-B files (no gradients, no `animate-pulse`, no `🧠`/`🚨`/`💡`/`🤖` in new files, no "Demo User", no "AI Score" copy).
- [ ] All 7 modified files unchanged outside their PR-B scope (the Org `Hackathons.tsx` only changed at the data import — UI unchanged; `matchResults.tsx` only added the banner+filter+CTA branches; etc.).
- [ ] All 13 created files pass ESLint.
- [ ] User has manually verified the 11-step smoke test.
- [ ] Push branch when user gives the OK (don't push proactively).

When the smoke test passes, the branch `feature/integrate-role-sections` is ready to merge to `main`. PR-C builds on top of it: idea brief, AI scoring, Team Momentum Score, 4-hour check-ins, the build/submit stages.
