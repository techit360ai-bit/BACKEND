# Collaborator Role Rebuild — Design

**Date:** 2026-05-26
**Branch:** `feature/integrate-role-sections`
**Source export:** Figma Make — "Collaborator Command Center Dashboard"
**Pattern reference:** Investor section (`dabcb7a`), Organization section (`4ebf2c9`)

## Goal

Rebuild the Collaborator role end-to-end from the Figma Make "Collaborator Command Center Dashboard" export, replacing the deleted flat files. The rebuild must:

- Match the file shape and routing conventions of the recent Investor and Organization rebuilds.
- Strip the export's "vibe-coded" feel — floating AI Copilot bubble, emoji-laden headings (🧠 🚨 💡 🤖), neon gradient hero panels, animate-pulse dots.
- Make Equity / Ownership a peer of Earnings everywhere, with a dedicated `/collaborator/equity` page. Building for Equity is TechIT's core mission and the UI must reflect that.
- Add a complete 6-step onboarding flow covering all tech disciplines.
- Add Profile and Settings pages.
- Add a Roles & Switching control in Settings AND a top-bar profile menu shortcut on every collaborator page.
- Surface the existing `/feed` route from the sidebar (same external-link pattern Org uses).
- Wire every action button to a real destination — navigation, dialog, or local-state mutation. No dead chrome.

## Out of scope

- No backend integration. Everything is mock data + local state.
- No real auth — `Sign out` is a toast.
- No real OAuth for tool integrations — `Connect` flips a status flag.
- No file upload — avatar / grant-document / message attachment buttons fire toasts.
- Founder section is not rebuilt in this PR; we only consume `/feed` from it.
- Workspaces section already exists; `Open in workspace` just deep-links into it.

## Architecture

### File layout (mirrors `investors/section/` and `organization/section/`)

```
frontend/src/dashboard/collaborators/
├── onboarding/
│   ├── CollabProgressBar.tsx
│   ├── CollabStep1.tsx           # Identity
│   ├── CollabStep2.tsx           # Discipline & sub-skills
│   ├── CollabStep3.tsx           # Tech stack & tools
│   ├── CollabStep4.tsx           # Availability
│   ├── CollabStep5.tsx           # Mission: Building for Equity
│   └── CollabStep6.tsx           # Portfolio & goals
└── section/
    ├── components/
    │   ├── collab/               # NEW — all role-owned pages live here
    │   │   ├── CollabLayout.tsx        # slate sidebar + top-bar role menu
    │   │   ├── TopBarRoleMenu.tsx      # shared profile/role dropdown
    │   │   ├── Dashboard.tsx
    │   │   ├── Tasks.tsx
    │   │   ├── Performance.tsx
    │   │   ├── Earnings.tsx
    │   │   ├── Equity.tsx              # NEW page
    │   │   ├── Opportunities.tsx
    │   │   ├── Reputation.tsx
    │   │   ├── Messages.tsx
    │   │   ├── Tools.tsx
    │   │   ├── CollabProfile.tsx       # NEW page
    │   │   └── Settings.tsx            # NEW page (4 sections)
    │   ├── ui/                   # kept from Figma export
    │   └── figma/                # kept from Figma export
    └── data/
        └── mockData.ts           # rewritten + extended
```

### Files deleted from the Figma export after content migrates

- `section/components/AICopilot.tsx` — floating bubble removed entirely.
- `section/components/Sidebar.tsx` — replaced by `CollabLayout.tsx`.
- `section/layouts/WorkspaceLayout.tsx` — replaced by `CollabLayout.tsx`.
- `section/pages/` — entire directory; content migrates into `components/collab/`.

## Routes

All routes live under `/collaborator/*`. The layout block matches Investor/Org nesting.

| Path | Page | Source |
|---|---|---|
| `/collaborator/onboarding/step-1` … `/step-6` | `CollabStep1` … `CollabStep6` | new |
| `/collaborator/dashboard` | `Dashboard` | rebuilt |
| `/collaborator/tasks` | `Tasks` | rebuilt |
| `/collaborator/performance` | `Performance` | rebuilt |
| `/collaborator/earnings` | `Earnings` | rebuilt, slimmed (cash-only) |
| `/collaborator/equity` | `Equity` | **new** |
| `/collaborator/opportunities` | `Opportunities` | rebuilt |
| `/collaborator/reputation` | `Reputation` | rebuilt |
| `/collaborator/messages` | `Messages` | rebuilt |
| `/collaborator/tools` | `Tools` | rebuilt |
| `/collaborator/profile` | `CollabProfile` | **new** |
| `/collaborator/settings` | `Settings` | **new** |

### Legacy redirects

```tsx
<Route path="/collaborator/setup"   element={<Navigate to="/collaborator/onboarding/step-1" replace />} />
<Route path="/collaborator/summary" element={<Navigate to="/collaborator/dashboard" replace />} />
```

`Landing.tsx` currently does `navigate("/collaborator/setup", { state: { celebrate: true } })` — the redirect preserves that entry point.

### `App.tsx` wiring (final shape)

```tsx
import { CollabLayout } from "@/dashboard/collaborators/section/components/collab/CollabLayout";
import { Dashboard as CollabDashboard } from "@/dashboard/collaborators/section/components/collab/Dashboard";
import { Tasks as CollabTasks } from "@/dashboard/collaborators/section/components/collab/Tasks";
import { Performance as CollabPerformance } from "@/dashboard/collaborators/section/components/collab/Performance";
import { Earnings as CollabEarnings } from "@/dashboard/collaborators/section/components/collab/Earnings";
import { Equity as CollabEquity } from "@/dashboard/collaborators/section/components/collab/Equity";
import { Opportunities as CollabOpportunities } from "@/dashboard/collaborators/section/components/collab/Opportunities";
import { Reputation as CollabReputation } from "@/dashboard/collaborators/section/components/collab/Reputation";
import { Messages as CollabMessages } from "@/dashboard/collaborators/section/components/collab/Messages";
import { Tools as CollabTools } from "@/dashboard/collaborators/section/components/collab/Tools";
import { CollabProfile } from "@/dashboard/collaborators/section/components/collab/CollabProfile";
import { Settings as CollabSettings } from "@/dashboard/collaborators/section/components/collab/Settings";
import { CollabStep1 } from "@/dashboard/collaborators/onboarding/CollabStep1";
// … CollabStep2..6

<Route path="/collaborator/onboarding/step-1" element={<CollabStep1 />} />
<Route path="/collaborator/onboarding/step-2" element={<CollabStep2 />} />
<Route path="/collaborator/onboarding/step-3" element={<CollabStep3 />} />
<Route path="/collaborator/onboarding/step-4" element={<CollabStep4 />} />
<Route path="/collaborator/onboarding/step-5" element={<CollabStep5 />} />
<Route path="/collaborator/onboarding/step-6" element={<CollabStep6 />} />

<Route path="/collaborator" element={<CollabLayout />}>
  <Route index element={<Navigate to="/collaborator/dashboard" replace />} />
  <Route path="dashboard" element={<CollabDashboard />} />
  <Route path="tasks" element={<CollabTasks />} />
  <Route path="performance" element={<CollabPerformance />} />
  <Route path="earnings" element={<CollabEarnings />} />
  <Route path="equity" element={<CollabEquity />} />
  <Route path="opportunities" element={<CollabOpportunities />} />
  <Route path="reputation" element={<CollabReputation />} />
  <Route path="messages" element={<CollabMessages />} />
  <Route path="tools" element={<CollabTools />} />
  <Route path="profile" element={<CollabProfile />} />
  <Route path="settings" element={<CollabSettings />} />
</Route>

<Route path="/collaborator/setup"   element={<Navigate to="/collaborator/onboarding/step-1" replace />} />
<Route path="/collaborator/summary" element={<Navigate to="/collaborator/dashboard" replace />} />
```

Imports/routes removed (from `frontend/src/App.tsx` lines 6-14, 99-114): `CollaboratorSetup`, `CollaboratorSummary`, `CollaboratorDashboard` (old flat), `AITaskCenter`, `ToolsPage`, `OpportunitiesPage`, `PerformancePage`, `MessagesPage`, `EarningsPage`.

## CollabLayout

### Sidebar

- **Surface:** `bg-slate-900` (near-black), `text-slate-300`.
- **Active item:** `bg-amber-500/10 text-amber-400 border-l-2 border-amber-500`.
- **Back to TechIT** link top-left in `text-slate-500`, arrow icon.
- **Header:** `TECHIT` wordmark in amber, "Collaborator Portal" subtitle.

Navigation order:

```
Dashboard            (LayoutDashboard)
Tasks                (CheckSquare)
Performance          (TrendingUp)
Earnings             (DollarSign)
Equity               (PieChart)         ← peer of Earnings
Opportunities        (Sparkles)
Reputation           (Award)
Messages             (MessageSquare)
Tools                (Wrench)
Feed             Hub (Rss, external → /feed)

Profile              (UserCircle)
Settings             (Settings)
```

The `Feed` row uses the same `external: true` pattern as Org's `OrgLayout` — `Hub` badge, links to the existing `/feed` route shared with Founders.

### Sidebar footer card

```
Building for Equity
$48.2K ownership across 3 startups
View equity →
```

Reads from `equityTotals` in mockData. Clicking the card or `View equity →` navigates to `/collaborator/equity`.

### Top bar — `TopBarRoleMenu.tsx`

Right-aligned across every `/collaborator/*` page. Avatar + name → dropdown:

```
Alex Chen
Collaborator · Frontend · ML
───────────────────────────────────
View profile                       → /collaborator/profile
Settings                           → /collaborator/settings
───────────────────────────────────
Switch role
  Founder       ✓ active           → /dashboard
  Investor      Activate to use    → /investor/onboarding/step-1
  Organization  Activate to use    → /org/onboarding/step-1
───────────────────────────────────
Log out                            (toast — no auth wiring yet)
```

Active-roles state comes from `useActiveRoles()` (see UserContext below). An active role goes to its dashboard; an inactive role goes to that role's onboarding step 1.

### Layout shell

```tsx
<div className="flex h-screen bg-slate-50">
  <Sidebar />                                {/* slate-900 */}
  <main className="flex-1 overflow-hidden flex flex-col">
    <TopBar />                               {/* breadcrumb + TopBarRoleMenu */}
    <div className="flex-1 overflow-y-auto"><Outlet /></div>
  </main>
  <Toaster richColors position="bottom-right" />
</div>
```

`<Toaster />` is mounted once here (sonner — already present in tree). No `<AICopilot />`.

## Onboarding wizard

Same shell as Investor / Org onboarding: left-rail progress + single-column form + sticky footer `← Back` / `Continue →`. State persists to `UserContext.collaboratorProfile` on every field blur via `updateCollaboratorProfile()`. Each step also has a top-right `Save & exit` that persists state and routes to `/dashboard`.

### Step 1 — Identity

Fields: `name`, `title`, `location` (country combobox), `yearsExperience`, `headline` (one-line). All required for Continue.

### Step 2 — Discipline & sub-skills

Primary discipline (radio cards, exactly one): `Engineering · Design · Product · Data & ML · DevOps · Security · Marketing · Research`.

Sub-skills (3–8 chips required) filtered by discipline. Curated lists, ~14 each:

- **Engineering** — React, TypeScript, Node.js, Python, Go, Rust, System design, Performance, Mobile (RN/iOS/Android), Backend APIs, Testing, GraphQL, Realtime, Web3
- **Design** — Product, Visual, Brand, UX research, Design systems, Motion, Illustration, Prototyping, 3D, Webflow/Framer, Figma, Pitch decks, Marketing pages, Iconography
- **Product** — Discovery, Roadmapping, PRDs, Analytics, Pricing, GTM, Growth experiments, A/B testing, Stakeholder mgmt, Customer interviews, Spec writing, Prioritisation, OKRs, PMing AI features
- **Data & ML** — Modelling, MLOps, NLP, CV, RAG, Fine-tuning, Evals, Recommenders, Time series, Forecasting, SQL, dbt, Notebooks, Dashboards
- **DevOps** — AWS, GCP, Azure, K8s, Terraform, CI/CD, Observability, Incident response, Cost optimization, Container orchestration, Edge/CDN, Serverless, Networking, Backups
- **Security** — AppSec, Pen testing, SAST/DAST, Threat modelling, IAM, Compliance (SOC2/ISO/GDPR), Secrets mgmt, Audit logging, Zero trust, Crypto, Incident response, Bug bounty, Cloud security, Red team
- **Marketing** — Content, SEO, Paid ads, Lifecycle, Email, Brand, Social, Community, PR, Launches, Partnerships, Analytics, Creator marketing, Founder-led
- **Research** — User research, Market research, Behavioural research, Quant, Qual, Surveys, Diary studies, Usability, Interviews, Competitive analysis, Synthesis, Repository, Insights, Strategy

### Step 3 — Tech stack & tools

Free-form chip input with suggestion seeds derived from chosen sub-skills. No max; min 3.

### Step 4 — Availability

- `weeklyHours` — slider 5–60
- `timezone` — combobox
- `earliestStart` — radio: This week / 2 weeks / 1 month
- `commitmentStyle` — radio: One startup deeply / 2–3 in parallel / Many short engagements

### Step 5 — Mission: Building for Equity

Intro paragraph (~3 lines) explaining the thesis, then:

- `equityPreference` — slider 0–100 (0 = all cash, 100 = all equity)
- Live readout: "you: 65% equity / 35% cash"
- `minCashFloor` — number input ($ per month)
- `vestingComfort` — radio: 1y cliff + 4y vest / Standard (4y, 1y cliff) / Custom

Expandable "How equity works on TechIT" below the slider — three bullets on vesting, dilution protection, platform as cap-table custodian. Same copy referenced from the Equity page's footer panel.

### Step 6 — Portfolio & goals

- `links.github`, `links.linkedin`, `links.portfolio`, `links.twitter` — all optional URLs
- `whyHere` — one-line text
- `pinnedWork[]` — up to 3 URLs

**On Step 6 submit:** set `onboardingComplete: true`, navigate to `/collaborator/dashboard`, fire `toast.success("You're in. Welcome to TechIT.")`.

### Defensive routing

`<CollabLayout />` reads `collaboratorProfile.onboardingComplete`. If `false` and the user lands on any non-onboarding `/collaborator/*` route, redirect to `/collaborator/onboarding/step-1`. Same pattern Investor section uses.

## Pages

### Dashboard

**Equity-led, earnings supporting.** No floating AI Copilot. No gradient hero. No emoji headings. No animate-pulse dots.

Layout top → bottom:

1. **Greeting strip** — "Good morning, Alex." · weekday · "N active builds"
2. **Equity hero (2/3 width) + Earnings (1/3 width):**
   - Equity hero shows: `$48,200 total value`, `1.6% blended equity across 3 startups`, per-startup list (logo · name · % · $-value · vested %), next-vest highlight.
   - Earnings card shows: `$128,450 lifetime`, `$12,350 pending payout`, `$14,200 revenue share (TTM)`.
3. **Active Builds** — 3 cards (one per startup): logo, name, role, progress bar, sprint goal, deadline, status pill. Each card has `[Open workspace]` and `[Mark today's standup]`.
4. **Today's focus + Signals** (2-column):
   - Today's focus — top 3 tasks by impact + deadline. No "AI Reason" italics. Each row: checkbox, title, project · due · impact. `[View all tasks]` at bottom.
   - Signals panel (replaces `aiInsights`) — grounded items only: "2 messages awaiting reply" / "NeuralSync vest in 17 days" / "1 opportunity matches your stack (CloudVault, 92%)". Each row is a quiet link to its source page.
5. **Recent activity** — one-line cross-startup entries: "project · what happened · timestamp".

Status pills use neutral muted backgrounds (slate-100 / red-50 / amber-50 / emerald-50), not bordered cards with neon edges.

### Tasks

Three sections by time (Today / This week / Later) + a collapsed Completed pane. Each task row: checkbox, title, project · impact · due, and three actions: `[Mark complete]` · `[Open in workspace]` · `[Snooze 1d]`.

- Filter dropdown — by project / priority. Sort — by impact / deadline / project.
- `+ Add task` opens a Dialog (project picker, title, due, priority, impact).

### Performance

- Five core metrics row: Execution Velocity, Consistency, Completion Rate, Collaboration, Impact. Each with ↑↓ change arrow + number.
- Velocity-over-time chart: single amber line, last 12 weeks of `weeklyVelocity`.
- Per-project contribution table: project · role · tasks shipped · impact avg · last contribution. Row click → workspace.
- Time-range picker top-right: Last 30 / 90 / 365 days.

### Earnings

Cash-only (equity moved to its own page).

- Three stat cards: Lifetime / Pending / Revenue share (TTM).
- Per-startup breakdown table with `[Equity →]` chip on each row (links to `/collaborator/equity#startup-{id}`).
- Payout history chart (12 months, bar chart, single amber).
- `[Withdraw funds]` Dialog: bank-detail picker + amount → submit creates a `processing` payout entry.

### Equity (new page)

The page that operationalises "Building for Equity is our core mission."

1. **Hero stats:** total value · blended equity % · vested this quarter · next vest date.
2. **Vesting timeline chart** — stacked area per startup over a 4-year horizon, with cliff markers.
3. **Per-startup equity cards** — one per `EquityHolding`: equity %, $-value, vested %, vesting schedule, grant date, next vest, with `[View cap table]` and `[Grant document →]` buttons.
4. **"How equity works on TechIT"** — expandable, same copy as the onboarding step 5 explainer.

### Opportunities

- Filter pills: All / Project / Advisory / Gig / Testing.
- Card grid (3 per row): title, type, company, match %, cash + equity, time commitment, skills, team quality, risk level.
- Each card: `[View details]` (Drawer with full payload) · `[Express interest]` (mutates to "Application sent" green-tinted state) · `[Pass]` (removes with 5s undo toast).
- `Refresh matches` link top-right → shuffles match-score order.

### Reputation

- Reputation score with radial chart breakdown (Execution, Consistency, Completion, Collaboration, Impact).
- Endorsements list (47 mock entries) — avatar, name, role, quote. Paginated 10/page.
- Badges earned grid — 4 of 6 from `badges` mock data. Locked tiles show muted with unlock criteria.
- Leaderboard top-10 with the current user row highlighted in soft amber. Time-range toggle: this month / quarter / all time.

### Messages

Two-column: inbox list (1/3) + conversation pane (2/3).

- Each `Conversation` has a `thread: ConversationMessage[]`.
- `[Send]` appends `{fromMe: true}` to the active thread. No toast.
- `[Attach]` fires a toast (mock).
- `[Compose]` Dialog (project + recipient + subject + body) → submit creates a new `Conversation`.
- Unread dot clears when conversation opens.

### Tools

- Connected tools grid (6 entries from mockData, expandable to 14).
- Each card: name · status · update count · `[Manage]` or `[Connect]`.
- `[Connect]` opens mock OAuth Dialog ("Continue to GitHub" single button) → flips status, increments `updates: 1`.
- `[Manage]` Dialog shows scopes + `[Disconnect]` red button.
- `[+ Connect new tool]` Dialog with 8 picks (Slack, Sentry, PostHog, Stripe, ClickUp, Loom, Cal.com, Calendly) → adds disconnected card.
- Recent updates feed below the grid: cross-tool activity timeline.

### Profile (new page)

Read view of `UserContext.collaboratorProfile`. Same visual rhythm as `InvestorProfile.tsx` and `OrgProfile.tsx`.

Sections:

1. **Header strip** — avatar, name, title · location · years, headline, availability indicator. `[Edit profile]` → `/collaborator/settings#identity`.
2. **Reputation strip** — Reputation 94 · Execution 87 · Completed 12 · Endorsements 47.
3. **Discipline & skills** — discipline label, sub-skills, stack.
4. **Compensation philosophy** — "Building for Equity · 65% equity / 35% cash · Min cash $2,000/mo · Standard vesting".
5. **Active builds** — same per-startup tiles as dashboard, lighter chrome.
6. **Pinned work** — up to 3 URLs from onboarding step 6.
7. **Badges earned** — earned tiles only.
8. **Links** — GitHub · LinkedIn · Portfolio · X.

### Settings (new page)

Single page, left-rail sub-nav, four sections with anchor links:

#### `#identity` — Account & Identity

Avatar upload (mock), name, professional title, location, years experience, headline, contact email, change-password. `[Save]` → `updateCollaboratorProfile()` + toast.

#### `#skills` — Skills & Availability

Editable mirror of onboarding steps 2 + 3 + 4 + 5 in a single form. `[Save]` → `updateCollaboratorProfile()` + toast.

#### `#notifications` — Notifications

Four toggle groups, each with Email + In-app checkboxes:

1. New opportunities matching my skills
2. Task deadlines (24h / 4h / overdue)
3. Payments & cash payouts
4. Equity events (vesting milestones, new equity granted, dilution notices)

Plus a quiet hours dropdown: `Off` / `10pm–8am` / `Always quiet on weekends`. `[Save]` → `updateCollaboratorProfile()` + toast.

#### `#roles` — Roles & Switching

```
Your roles on TechIT

● Collaborator       Active · current role               [Switch to] (disabled)
  Building for equity across 3 startups
─────────────────────────────────────────────────────────
● Founder            Active                              [Switch to] → /dashboard
  1 startup: NeuralSync AI
─────────────────────────────────────────────────────────
○ Investor           Not activated                  [Activate role] → /investor/onboarding/step-1
  Spot opportunities, build a portfolio
─────────────────────────────────────────────────────────
○ Organization       Not activated                  [Activate role] → /org/onboarding/step-1
  Run programs, hackathons, talent pools
```

Bottom of page: `Sign out` red link → toast `"Signed out (mock)"`.

## Action-button-to-destination map (master)

Every button on every page. Anything not on this list either doesn't exist or gets cut.

| Page | Button | Behavior |
|---|---|---|
| Sidebar footer | `View equity →` | nav `/collaborator/equity` |
| Top-bar role menu | `View profile` | nav `/collaborator/profile` |
| | `Settings` | nav `/collaborator/settings` |
| | `Switch to Founder` | nav `/dashboard` |
| | `Switch to Investor` | nav `/investor/dashboard` if active, else `/investor/onboarding/step-1` |
| | `Switch to Organization` | nav `/org/dashboard` if active, else `/org/onboarding/step-1` |
| | `Log out` | toast `"Signed out (mock)"` |
| Dashboard | `View full equity →` | nav `/collaborator/equity` |
| | `View earnings →` | nav `/collaborator/earnings` |
| | `Open workspace` (per build) | nav `/workspaces/build?startup={id}` |
| | `Mark today's standup` | local state: append `recentActivity` entry; toast `"Standup logged"` |
| | `View all tasks` | nav `/collaborator/tasks` |
| | Signal row click | nav to that signal's `href` |
| Tasks | `Mark complete` | mutate task `status: "completed"`; toast |
| | `Open in workspace` | nav `/workspaces/build?startup={id}` |
| | `Snooze 1d` | mutate `deadline += 1d`; re-sort; toast |
| | `+ Add task` | open Dialog → append to tasks state |
| | `Filter ▾` / `Sort ▾` | local UI state, no nav |
| Performance | Project row click | nav `/workspaces/build?startup={id}` |
| | Time range `Last 30/90/365` | local UI state |
| Earnings | `Withdraw funds` | Dialog → move amount from `pending` to `processing`; toast |
| | `Equity →` (per row) | nav `/collaborator/equity#startup-{id}` |
| Equity | `Equity philosophy →` | anchor-scroll to "How equity works" |
| | `View cap table` | open read-only cap-table Dialog |
| | `Grant document →` | toast `"Grant document downloaded (mock PDF)"` |
| Opportunities | `View details` | open side Drawer |
| | `Express interest` | mutate `status: "applied"`; flip card; toast |
| | `Pass` | remove from local state; 5s undo toast |
| | `Refresh matches` | shuffle match-score order; toast |
| | Filter pills | local UI state |
| Reputation | Badge tile click | Dialog explaining criteria |
| | Leaderboard timeframe | local UI state |
| Messages | `Send` | append `ConversationMessage{fromMe: true}` |
| | `Attach` | toast `"Attachment uploaded (mock)"` |
| | `Compose` | Dialog → append new Conversation |
| | Inbox row click | clear unread, open in pane |
| Tools | `Connect` (per card) | Dialog → flip status to `connected`; toast |
| | `Manage` | Dialog with scopes + `Disconnect` button (toast) |
| | `+ Connect new tool` | Dialog with 8 picks → adds disconnected card |
| Profile | `Edit profile` | nav `/collaborator/settings#identity` |
| Settings — Identity | `Save` | `updateCollaboratorProfile()`; toast |
| Settings — Skills | `Save` | `updateCollaboratorProfile()`; toast |
| Settings — Notifications | each toggle | mutate `notifications` slice |
| | `Save` | `updateCollaboratorProfile()`; toast |
| Settings — Roles | `Switch to` (active role) | nav to that dashboard |
| | `Activate role` (inactive) | nav to that onboarding step 1 |
| | `Sign out` | toast `"Signed out (mock)"` |
| Onboarding | `Continue →` (every step) | `updateCollaboratorProfile()`; nav next step |
| | `← Back` | nav previous step |
| | Step 6 `Continue →` | set `onboardingComplete: true`; nav `/collaborator/dashboard`; toast |
| | `Save & exit` (every step) | persist; nav `/dashboard` |

**No-dead-buttons rule:** if a button can't be wired during the rebuild, it gets removed, not left inert.

## UserContext changes

The file is already mid-edit — `CollaboratorProfile` is defined but not threaded through the provider. This rebuild finishes and extends it.

### Extended `CollaboratorProfile`

```ts
export interface CollaboratorProfile {
  // Step 1 — Identity
  name: string;
  title: string;
  location: string;
  yearsExperience: number;
  headline: string;                       // NEW
  avatarUrl: string;                      // NEW

  // Step 2 — Discipline & sub-skills
  discipline: CollaboratorDiscipline | "";
  subSkills: string[];

  // Step 3 — Tech stack
  techStack: string[];

  // Step 4 — Availability  (extended)
  weeklyHours: number;
  timezone: string;                       // NEW
  earliestStart: "this-week" | "2-weeks" | "1-month";  // NEW
  commitmentStyle: "deep" | "parallel" | "many";       // NEW

  // Step 5 — Mission: Building for Equity  (renamed + extended)
  equityPreference: number;        // 0 = all cash, 100 = all equity
  minCashFloor: number;            // monthly  — was hourlyRateFloor
  vestingComfort: "standard" | "1y-cliff-4y" | "custom";  // NEW

  // Step 6 — Portfolio & goals
  links: { github: string; linkedin: string; portfolio: string; twitter: string };
  whyHere: string;
  pinnedWork: string[];                   // NEW — up to 3 URLs

  // Status / settings
  onboardingComplete: boolean;            // NEW — gates dashboard access
  notifications: NotificationPrefs;       // NEW
}

export interface NotificationPrefs {
  opportunities: { email: boolean; inApp: boolean };
  deadlines:     { email: boolean; inApp: boolean };
  payments:      { email: boolean; inApp: boolean };
  equityEvents:  { email: boolean; inApp: boolean };
  quietHours:    "off" | "10pm-8am" | "weekends";
}
```

**Removed:** `hourlyRateFloor` (superseded by `minCashFloor`).

### Provider wiring (three additions)

1. `collaboratorProfile` state and `updateCollaboratorProfile` function in the provider (modelled exactly on `orgProfile`).
2. Both added to the context value object (currently absent at lines 166-171 of `UserContext.tsx`).
3. `useCollaboratorProfile()` convenience hook at the bottom of the file.

### Active roles derivation

```ts
export type Role = "founder" | "collaborator" | "investor" | "org";

export function useActiveRoles(): { activeRoles: Set<Role>; currentRole: Role } {
  // A role is active iff its onboardingComplete flag is true.
  // currentRole is derived from the location prefix:
  //   /collaborator/* → "collaborator"
  //   /investor/*     → "investor"
  //   /org/*          → "org"
  //   else            → "founder"
}
```

Top-bar role menu and Settings → Roles section both read from this hook.

**Founder caveat:** Founders don't have a typed profile in UserContext yet. For this PR, the Founder role is treated as active by default — the app currently assumes Founder is the entry-point role. A typed `founderProfile` gets built when the Founder section gets its own Figma Make rebuild; out of scope here.

## Mock data changes (`section/data/mockData.ts`)

The existing file is the starting point but needs equity-first restructuring.

### Restructure `earnings` → split into cash + equity

```ts
export interface EquityHolding {
  projectId: string;
  projectName: string;
  equityPercent: number;          // 0.8 = 0.8%
  valueUSD: number;
  vestedPercent: number;          // 0–100
  vestingSchedule: { years: number; cliffMonths: number };
  grantDate: string;              // ISO
  nextVest: { date: string; deltaPercent: number } | null;
  capTable: CapTableRow[];        // for View cap table Dialog
}

export interface CashEarning {
  projectId: string;
  projectName: string;
  earned: number;
  pending: number;
  revenueSharePercent: number;
  contributionNote: string;
}

export const equityHoldings: EquityHolding[];
export const cashEarnings: CashEarning[];

export const equityTotals = {
  totalValueUSD: 48200,
  blendedEquityPercent: 1.6,
  vestedThisQuarterUSD: 6400,
  nextVest: { startup: "NeuralSync", date: "2026-06-12", deltaPercent: 0.2 },
};
```

### New: `payouts`

12 monthly entries for the Earnings page payout-history chart: `{ month, amount, status }`.

### New: `vestingTimeline`

Month-by-month vested % per holding over a 4-year horizon, derived from `equityHoldings`.

### New: `endorsements`

`{ id, fromName, fromRole, fromAvatar, quote, projectName, date }[]` for the Reputation page.

### New: `conversations` (replaces `messages`)

```ts
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
export const conversations: Conversation[];
```

### Extended `tools` → `ToolIntegration[]`

```ts
export interface ToolIntegration {
  id: string;
  name: string;
  status: "connected" | "disconnected";
  scopes: string[];
  lastSyncedAt: string | null;
  updates: number;
}
```

### Extended `opportunities`

Add `cashCompMonthly`, `equityPercent`, `description`, `teamBios[]`, `timeline` so the side-drawer detail view has content.

### Promote `recentActivity` to top-level

Currently embedded per-Project. Promote to a top-level array so the dashboard panel can mix entries across all startups in time order.

### Drop `aiInsights` → introduce `signals`

```ts
export interface Signal {
  id: string;
  type: "messages" | "vesting" | "opportunity" | "deadline";
  message: string;
  href: string;       // every signal is a link to its source page
}
```

Concrete facts only — no editorial commentary.

### Date freshness

All mock dates shift to be relative to **today (2026-05-26)**. Existing data uses 2026-04-XX (now past).

- Active project deadlines: late May / June 2026.
- Next vest: mid-June 2026.
- Recent activity timestamps: computed off `Date.now()` in components, not hardcoded strings.

## Visual tone rules

Codified once, applied across every page.

- **One accent color: amber-500.** Used only for active sidebar item, primary buttons, the single line/bar in charts, and the next-vest highlight.
- **Status colors:** soft tinted backgrounds only — `slate-100/600` neutral, `emerald-50/700` healthy, `amber-50/700` risk, `red-50/700` critical. Never neon-bordered cards.
- **No emoji in UI text.** Project entries can keep emoji *logos* (🧠 NeuralSync, 💰 FinFlow, 🏥 HealthTrack) but headings, badges, and labels are text-only.
- **No motion-pulse, no animate-pulse dots, no gradient hero panels.** Page entrance is a single subtle `fade-in` at most.
- **Typography:** semibold for h2/h3, regular for body, mono only for IDs/code. No `tracking-tight` everywhere.
- **Cards:** single thin `border-slate-200`, no shadow except on Dialogs/Drawers. White surface on light bg.
- **Sidebar:** `bg-slate-900`, `text-slate-300`, active item `bg-amber-500/10 text-amber-400 border-l-2 border-amber-500`.
- **Numbers:** `tabular-nums` everywhere stats are shown so columns align.
- **No AI branding anywhere in the UI** — no "AI Copilot", no "AI Insights", no "AI Verified" badge, no "AI Ranked" badges, no `🤖` icons. The platform is intelligent without announcing it.

## Toast library

`sonner` — already in tree at `frontend/src/dashboard/collaborators/section/components/ui/sonner.tsx`. Mounted once in `CollabLayout` with `position="bottom-right"`. Same approach Org uses.

## Risks / open items

- The `useActiveRoles()` hook needs to render correctly on the *first* route after activating a role, which means the role menu must re-derive on route change. Implementation will use `useLocation()` inside the hook.
- `recentActivity` ages relative to `Date.now()` — needs a small `formatRelative()` helper to avoid stale "2h ago" labels after long sessions. Worth a 10-line utility, not a full library.
- The Founder role being "always active" is a temporary simplification. Document the carve-out in code comments so the next person rebuilding Founder knows to revisit.

## Definition of done

- All 12 collaborator pages render without console errors.
- Onboarding wizard persists state across all 6 steps; refresh on any step does not lose data.
- `onboardingComplete` gate redirects unfinished users back to step 1.
- Every button in the master action map either navigates, opens a Dialog/Drawer, or mutates local state + toasts. No dead buttons.
- Top-bar role menu visible on all `/collaborator/*` pages with working Switch-to / Activate destinations.
- Sidebar Feed link navigates to existing `/feed` route.
- `App.tsx` flat collaborator routes removed; legacy `/collaborator/setup` and `/summary` redirect.
- `AICopilot.tsx`, the export `Sidebar.tsx`, `layouts/WorkspaceLayout.tsx`, and `pages/` directory deleted.
- No emoji in UI text outside of brand logos. No `animate-pulse` on dots. No gradient hero panels.
- Equity totals on the dashboard match the per-holding sum on the Equity page (single source of truth in `mockData.ts`).
