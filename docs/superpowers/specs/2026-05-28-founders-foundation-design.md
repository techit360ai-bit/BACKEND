# Founders Foundation — Design

**Date:** 2026-05-28
**Branch:** `feature/founders-foundation` (cut from `4ca1016` on `feature/integrate-role-sections`)
**Sub-project:** PR-A of three. PR-B = Opportunity Hub + hackathon switcher; PR-C = hackathon participant flow + momentum tracker.
**Pattern reference:** Collaborator section (commits `051e843`..`4ca1016`)

## Goal

Bring the Founder role to parity with Collaborator/Investor/Organization. PR-A delivers the foundation: a Founder-owned layout, a 6-step onboarding wizard, restructured dashboard, public Profile page, Settings page with role switching and identity verification, and removal of the dead `home.tsx` / global `Sidebar.tsx` chrome. No hackathon work in PR-A.

## Out of scope

- Opportunity Hub page (PR-B)
- Hackathon-specific incubation pipeline (PR-B + PR-C)
- Idea Hub — placeholder only, no implementation
- Market Pathway — placeholder only, no implementation
- Hackathon momentum tracker — PR-C
- IncubationHub refactor (873-line mega-file lives intact through PR-A)
- Real OAuth, real auth, real file uploads, real NIN verification API — all mock state + toasts
- Founder-side leaderboard / reputation — Collaborator-only concept; founders see endorsements only

## Architecture

### File layout (mirrors `collaborators/section/` and `investors/section/`)

```
frontend/src/
├── dashboard/founders/
│   ├── onboarding/
│   │   ├── FounderProgressBar.tsx
│   │   ├── FounderStep1.tsx        # Identity
│   │   ├── FounderStep2.tsx        # Startup snapshot
│   │   ├── FounderStep3.tsx        # Team & roles
│   │   ├── FounderStep4.tsx        # Traction & metrics
│   │   ├── FounderStep5.tsx        # Mission
│   │   └── FounderStep6.tsx        # Goals & links
│   └── section/
│       ├── components/
│       │   └── founder/
│       │       ├── FounderLayout.tsx
│       │       ├── TopBarRoleMenu.tsx
│       │       ├── Dashboard.tsx
│       │       ├── FounderProfile.tsx
│       │       └── Settings.tsx
│       └── data/
│           └── mockData.ts
└── lib/
    ├── roleRoutes.ts               # moved from collaborators/.../roleRoutes.ts
    └── formatRelative.ts           # deduped from collaborators/Dashboard.tsx
```

### Files deleted

- `frontend/src/dashboard/home.tsx` (replaced by new `Dashboard.tsx`)
- `frontend/src/dashboard/founderSetup.tsx` (already gone on disk — stage removal)
- `frontend/src/dashboard/founderSummary.tsx` (already gone on disk — stage removal)
- `frontend/src/dashboard/founders/setup.tsx` (replaced by 6-step wizard)
- `frontend/src/dashboard/founders/summary.tsx` (replaced by direct dashboard landing)
- `frontend/src/components/Sidebar.tsx` (replaced by `FounderLayout`)

### Files modified

- `frontend/src/contexts/UserContext.tsx` — add `FounderProfile`, `useFounderProfile()`, update `useActiveRoles()`
- `frontend/src/App.tsx` — drop flat founder routes, add nested `FounderLayout` block, legacy redirects
- `frontend/src/dashboard/incubationHub.tsx` — strip the `<Sidebar />` import + render (let the layout provide it)
- `frontend/src/dashboard/collaborators/section/components/collab/TopBarRoleMenu.tsx` — re-import from `@/lib/roleRoutes`
- `frontend/src/dashboard/collaborators/section/components/collab/Settings.tsx` — re-import from `@/lib/roleRoutes`
- `frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx` — re-import `formatRelative` from `@/lib/formatRelative`
- `frontend/src/dashboard/collaborators/section/components/collab/roleRoutes.ts` — delete (now lives in `@/lib/roleRoutes`)

## Routes

All routes live under `/founder/*` or share Founder concerns (`/dashboard`, `/incubation-hub`, `/chat`, `/matchresults`). Onboarding routes are siblings, not children, of the layout (no sidebar during onboarding).

| Path | Page | Source |
|---|---|---|
| `/founder/onboarding/step-1` … `/step-6` | `FounderStep1` … `FounderStep6` | new |
| `/dashboard` | `Dashboard` | rebuilt (replaces `home.tsx`) |
| `/founder/profile` | `FounderProfile` | new |
| `/founder/settings` | `Settings` | new |
| `/incubation-hub` | `IncubationHub` | unchanged (PR-B refactors) |
| `/chat` | `Chat` | unchanged |
| `/matchresults` | `MatchResults` | unchanged |

### Legacy redirects

```tsx
<Route path="/founder/setup"   element={<Navigate to="/founder/onboarding/step-1" replace />} />
<Route path="/founder/summary" element={<Navigate to="/dashboard" replace />} />
```

### `App.tsx` final shape (the parts that change)

```tsx
import { FounderLayout } from "@/dashboard/founders/section/components/founder/FounderLayout";
import { Dashboard } from "@/dashboard/founders/section/components/founder/Dashboard";
import { FounderProfile } from "@/dashboard/founders/section/components/founder/FounderProfile";
import { Settings as FounderSettings } from "@/dashboard/founders/section/components/founder/Settings";
import { FounderStep1 } from "@/dashboard/founders/onboarding/FounderStep1";
// … FounderStep2..6

{/* Onboarding — no layout */}
<Route path="/founder/onboarding/step-1" element={<FounderStep1 />} />
<Route path="/founder/onboarding/step-2" element={<FounderStep2 />} />
<Route path="/founder/onboarding/step-3" element={<FounderStep3 />} />
<Route path="/founder/onboarding/step-4" element={<FounderStep4 />} />
<Route path="/founder/onboarding/step-5" element={<FounderStep5 />} />
<Route path="/founder/onboarding/step-6" element={<FounderStep6 />} />

{/* Founder shell */}
<Route element={<FounderLayout />}>
  <Route path="/dashboard"          element={<Dashboard />} />
  <Route path="/founder/profile"    element={<FounderProfile />} />
  <Route path="/founder/settings"   element={<FounderSettings />} />
  <Route path="/incubation-hub"     element={<IncubationHub />} />
  <Route path="/chat"               element={<Chat />} />
  <Route path="/matchresults"       element={<MatchResults />} />
</Route>

{/* Legacy redirects */}
<Route path="/founder/setup"   element={<Navigate to="/founder/onboarding/step-1" replace />} />
<Route path="/founder/summary" element={<Navigate to="/dashboard" replace />} />
```

Imports/routes removed: `FounderSetup`, `FounderSummary`, `Dashboard` (old `home.tsx`), and any reference to the deleted global `Sidebar`.

## FounderLayout

### Sidebar

- **Surface:** `bg-white` border-right, `text-slate-700`
- **Active item:** `bg-violet-50 text-violet-700 border-l-2 border-violet-600`
- **Inactive clickable:** `text-slate-700 hover:bg-slate-50`
- **Disabled placeholders:** `text-slate-400 cursor-default` + `Soon` chip; rendered as `<span>` not `<Link>`
- **Header:** `TECHIT` wordmark in violet-600, "Founder Portal" subtitle in slate-500
- **Back to TechIT** link top-left, slate-500

Navigation order (final):

```
Dashboard                              → /dashboard          (LayoutDashboard)
Incubation Hub                         → /incubation-hub     (FlaskConical)
Workspaces                             → /workspaces         (PanelsTopLeft)
Feed                          Hub      → /feed (external)    (Rss)
─────  COMING SOON  ─────
Opportunity Hub               Soon     (placeholder)         (Sparkles)
Idea Hub                      Soon     (placeholder)         (Lightbulb)
Market Pathway                Soon     (placeholder)         (Route)
─────
Messages                               → /chat               (MessageSquare)
Investors                              → /matchresults       (LineChart)
Wallet                        Hub      → /wallet (external)  (Wallet)
─────
Profile                                → /founder/profile    (UserCircle)
Settings                               → /founder/settings   (Settings)
```

The `Hub` chip is the same external-link tag Org/Collaborator use. The `Soon` chip uses `bg-slate-100 text-slate-500`.

### Sidebar footer card

```
[avatar — initials from founderProfile.name]
Sarah Chen
Founder · AI Task Manager · MVP
```

Clicking the card navigates to `/founder/profile`. Reads `name`, `startupName`, and `stage` from `founderProfile`. No "Demo User" hardcoded anywhere.

### Top bar — `TopBarRoleMenu.tsx`

Identical component shape to Collaborator's, with the role labels reordered so Founder is first in the role list. Reads `founderProfile.name` for the avatar/label. Dropdown:

```
Sarah Chen
Founder · Building AI Task Manager
───────────────────────────────
View profile                          → /founder/profile
Settings                              → /founder/settings
───────────────────────────────
Switch role
  Founder       ✓ current
  Collaborator  Active                → /collaborator/dashboard
  Investor      Activate to use       → /investor/onboarding/step-1
  Organization  Activate to use       → /org/onboarding/step-1
───────────────────────────────
Log out                               (toast)
```

`useActiveRoles()` derivation in this PR:
- `founder` active iff `founderProfile.onboardingComplete === true` (replaces today's always-active carve-out)
- `collaborator` active iff `collaboratorProfile.onboardingComplete === true`
- `investor` active iff `investorProfile.industries.length > 0`
- `org` active iff `orgProfile.verificationStatus !== "unverified"`

`currentRole` derives from `location.pathname`:
- `/founder/*`, `/dashboard`, `/incubation-hub`, `/chat`, `/matchresults` → `founder`
- `/collaborator/*` → `collaborator`
- `/investor/*` → `investor`
- `/org/*` → `org`

### Defensive routing

`FounderLayout` reads `founderProfile.onboardingComplete`. If `false` and the route is not an onboarding step, redirect to `/founder/onboarding/step-1`. Same pattern Collaborator uses.

### Toast mount

`<Toaster richColors position="bottom-right" />` from `sonner` mounted once in `FounderLayout`.

## Onboarding wizard (6 steps)

Same shell as Org / Investor / Collaborator: left progress bar + single-column form + sticky `← Back` / `Continue →` footer + top-right `Save & exit`. State persists to `UserContext.founderProfile` on every field blur. `Save & exit` routes to `/` (Landing) — founders without onboarding don't have a dashboard yet.

### Step 1 — Identity

Required: `name`, `title`, `location`, `yearsBuilding`, `founderType` (radio: first-time / some-experience / serial), `headline`.

### Step 2 — Startup snapshot

Required: `startupName`, `oneLiner`, `stage` (radio: Idea/MVP/Beta/Launch/Growth), `industries` (1–3 chips), `foundingYear`, optional `website` and `logoEmoji`.

### Step 3 — Team & roles

Fields: `currentTeamSize` (number), `openRoles` (chip multi-select from 12 curated roles, max 5), `compensationOffered` (radio: equity-heavy / cash-equity-mix / cash-heavy), `equityRangeMin` and `equityRangeMax` (number, % units).

The 12 curated roles:
- Frontend Engineer · Backend Engineer · Full-stack Engineer
- ML Engineer · Designer (Product) · Designer (Visual)
- Product Manager · Data Scientist · DevOps Engineer
- Growth Marketer · Content / Copy · Founder Associate

### Step 4 — Traction & metrics

Fields: `launchStatus` (radio: pre-launch / private-beta / public), `users` (number), `revenueMonthly` (number USD), `fundingRaised` (number USD), `leadInvestor` (text, optional), `nextMilestone` (one-line text).

All numbers can be zero — pre-revenue / pre-launch is the realistic default.

### Step 5 — Mission: Why TechIT

Intro paragraph framing the TechIT thesis, then:
- `whyBuilding` — textarea
- `winningIn3Years` — textarea
- `unfairAdvantage` — textarea
- `ownershipPhilosophy` — radio: equity-day-one / cash-first-equity-later / custom

### Step 6 — Goals & links

Fields: `links.github`, `links.linkedin`, `links.twitter`, `links.personal` (all optional URLs), `needsFromTechIT` (chip multi-select from 10 curated needs, max 3), `pinnedWork` (up to 3 URLs, dynamic add/remove).

The 10 needs: Find collaborators · Find investors · Validate the idea · Build the MVP faster · Customer interviews · Pricing experiments · Hire first sales hire · Hackathon momentum · Mentorship · Just exploring.

Step 5 and Step 6 each show a small grey banner: "Verify your GitHub / socials / ID in Settings → Verification. Verified founders see more matches." Not blocking.

### On Step 6 submit

1. `updateFounderProfile({ ...payload, onboardingComplete: true })`
2. `toast.success("You're in. Welcome to TechIT, {firstName}.")`
3. `navigate("/dashboard")`

## Dashboard (`/dashboard`)

Restructured + restrained. Drops gradient stat tiles, drops "Demo User" anywhere, single violet-600 accent. Layout top → bottom:

1. **Greeting strip** — `"Good morning, {firstName}."  ·  weekday/date  ·  Week N of building`. The week count is derived from `Math.floor((Date.now() - new Date(\`${foundingYear}-01-01\`).getTime()) / (7 * 86_400_000))`, capped above 1.

2. **Startup hero (full width)** — logo emoji + startup name + status pill (`stage` in violet) + one-liner + a 4-stat row (`users` · `revenueMonthly`/mo · open roles count · "Top investor fit" — derives from a `signals[]` entry or shows "—"). Two ghost CTAs: `Edit startup details →` (→ `/founder/settings#startup`), `View public profile →` (→ `/founder/profile`).

3. **Journey strip** — 5-stage horizontal: Idea ✓ · Team Building (active%) · MVP (progress%) · Market Testing · Launch Ready. Active stage in `violet-600`, complete in `violet-200`, upcoming in `slate-200`. Click a stage opens an inline drawer with the per-stage `detail` string.

4. **Today's focus (2/3) + Signals (1/3)** — Today's focus reads `tasks[]` from mockData: checkbox, title, detail (project · due · priority pill), action `View all tasks` → `/incubation-hub`. Checkbox toggles `tasks[i].done` in local state + toast. Row click (outside checkbox) → `tasks[i].href`. Signals are read from mockData; each row is a quiet link to its `href`.

5. **Active builds (3 cards)** — `activeBuilds[]` from mockData: primary startup + side bets + a final `+ Start a side bet` tile (opens a Dialog → appends to local state). Each build card has logo + name + stage + progress bar + `Open workspace` (→ `/workspaces/build?startup={id}`).

6. **Recent activity** — flat cross-build feed from mockData. Timestamps via `formatRelative(timestampISO)`.

7. **Hackathon Momentum (empty-state)** — large card: `"No active hackathons. Join a hackathon from the Opportunity Hub to see your team's momentum tracker here — 4-hour check-ins, build velocity, blockers."` + a disabled `Browse opportunities →` button with `Soon` chip. PR-B enables; PR-C populates.

## Profile (`/founder/profile`)

Read view of `founderProfile`. Structure:

1. **Header strip** — avatar + name + `✓ Verified` chip (if any verification is true) + title · location · years · founder type + headline + availability line (`● Building · {currentTeamSize} cofounders · {openRoles.length} of 5 roles open`). `Edit profile` → `/founder/settings#identity`.

2. **Startup card (hero)** — logoEmoji + startupName + stage pill + oneLiner + foundingYear · industries + a 4-stat divider (users / revenue/mo / launch status / `${fundingRaised} raised`) + nextMilestone footnote.

3. **Mission card** — three text blocks (whyBuilding · winningIn3Years · unfairAdvantage).

4. **Compensation philosophy** — `bg-violet-50 border-violet-200` card with: "Building for Ownership · {ownership-philosophy human label} · {equityRangeMin}%–{equityRangeMax}% range · {compensationOffered human label}".

5. **Open roles** — up to 5 tiles for each role in `openRoles[]`: role name + equity range + cash-or-equity tag. `See all collaborators matching these roles →` → `/matchresults?roles={comma-separated}`.

6. **Stage journey (compact)** — same 5-stage strip as dashboard, read-only.

7. **Recent endorsements (top 3)** — quote + author · role · build · date. `See all {endorsements.length} →` link. If empty: empty state ("No endorsements yet. They appear after you complete an engagement with a collaborator.").

8. **Pinned work** — up to 3 URL tiles. Hidden entirely if `pinnedWork[]` is empty.

9. **Verification badges** — small chips row: each verification with `● green` if verified or `○ grey` if not. `Complete verification →` → `/founder/settings#verification`.

10. **Social links** — GitHub / LinkedIn / X / Personal site (icons + handles).

The `✓ Verified` chip on the header appears iff any of: `verification.github.verified`, `verification.twitter.verified`, `verification.linkedin.verified`, `verification.personalSite.verified`, or `verification.nin.status === "verified"`. Hover shows a tooltip listing what's verified.

## Settings (`/founder/settings`)

Single page, left sub-nav with 5 anchors. Sections render stacked; anchor links keep deep-link URLs.

### `#identity` — Account & Identity

Edits Steps 1 and 6 fields: avatar (file input mock), name, title, location, yearsBuilding, founderType, headline, contact email (local-state only — not in profile), change password (two inputs + `Update password` button — mock toast), and the four URL inputs from Step 6. `[Save]` → `updateFounderProfile()` + toast.

### `#startup` — Startup & Roles

Editable mirror of Steps 2 + 3 + 4 + 5 in one form, split into four logical blocks with hr dividers: Startup details, Team & roles, Traction, Mission. `[Save]` saves all four blocks at once.

### `#verification` — Verification

Three subcards:

**Social media verification:**
- Twitter — handle input + `Verify` button. Click flips `verification.twitter.verified = true` + toast `"Twitter verified"`.
- LinkedIn — URL input + `Verify` button, same mechanics.
- Personal site — URL input + `Verify` button, same mechanics.
- When verified, the row shows `✓ Verified` and an `Unverify` link that flips back to false.

**GitHub verification:**
- Not connected: `Continue to GitHub →` opens a Dialog with a single button "Continue to GitHub" → on click flips `verification.github.verified = true` + sets a default `username` + toast.
- Connected: shows username + a stat row (mock: 1.2K followers · 340 stars · top repo · last commit 2h ago) + red `Disconnect` link.

**Identity verification (NIN / ID):**
- Country dropdown (default Nigeria) + docType radio (NIN / Passport / Driver's licence) + docNumber input + front upload + back upload + `Submit for verification` button.
- Submit flips `verification.nin.status = "pending"` with amber chip "Under review · usually 1–3 business days". A `setTimeout` 5 seconds later flips to `"verified"` (mock — comment notes this is for demo only).

### `#notifications` — Notifications

Four toggle groups (Email + In-app checkboxes):
1. Collaborator applications
2. Investor activity
3. Workspace activity
4. Hackathons & opportunities

Plus quiet hours `<select>`: `off` / `10pm-8am` / `weekends`. `[Save]` → `updateFounderProfile()` + toast. Toggle handlers use full nested spread to avoid shallow-merge data loss on `notifications`.

### `#roles` — Roles & Switching

Reads `useActiveRoles()`. Renders 4 role cards in order: Founder (current), Collaborator, Investor, Organization. Active role gets `[Switch to]` button (navigates to that dashboard). Inactive gets `[Activate role]` (navigates to that onboarding). Current is shown disabled with "current role" sub-label.

Bottom of page: `Sign out` red link → `toast("Signed out (mock)")`.

## Action button master map

Every button on every page. No dead buttons. Three sidebar placeholder rows render as inert spans, not buttons.

| Page | Button | Behavior |
|---|---|---|
| Sidebar footer card | card click | nav `/founder/profile` |
| Top-bar role menu | View profile | nav `/founder/profile` |
| | Settings | nav `/founder/settings` |
| | Switch to {role} | nav role dashboard (active) or role onboarding (inactive) |
| | Log out | toast `"Signed out (mock)"` |
| Dashboard hero | body click | nav `/incubation-hub` |
| | Edit startup details → | nav `/founder/settings#startup` |
| | View public profile → | nav `/founder/profile` |
| Dashboard journey | stage click | inline expandable drawer |
| Dashboard tasks | checkbox | mutate `tasks[].done`; toast |
| | row click | nav `tasks[].href` |
| | View all tasks | nav `/incubation-hub` |
| Dashboard signals | row click | nav `signals[].href` |
| Dashboard active builds | card click | nav `/workspaces/build?startup={id}` |
| | + Start a side bet | open Dialog → append to `activeBuilds` |
| Dashboard momentum | Browse opportunities → | disabled (Soon) |
| Sidebar placeholders | Opportunity Hub / Idea Hub / Market Pathway | inert spans, `cursor-default` |
| Sidebar Feed / Wallet | row click | nav external (`/feed`, `/wallet`) |
| Sidebar Messages | row click | nav `/chat` (fixes today's broken link) |
| Sidebar Investors | row click | nav `/matchresults` |
| Profile | Edit profile | nav `/founder/settings#identity` |
| | See all collaborators… | nav `/matchresults?roles=…` |
| | Startup card click | nav `/incubation-hub` |
| | Complete verification → | nav `/founder/settings#verification` |
| | social link click | open in new tab |
| Settings — Identity | Save | `updateFounderProfile()`; toast |
| | Update password | clears fields; toast |
| Settings — Startup | Save | `updateFounderProfile()`; toast |
| Settings — Verification | Verify (social) | flip `verification.<type>.verified = true`; toast |
| | Unverify | flip to false; toast |
| | Continue to GitHub → | mock OAuth Dialog → flip GitHub verified; toast |
| | Disconnect (GitHub) | flip to false; toast |
| | Submit for verification (NIN) | flip status to `pending`; 5s timer flips to `verified`; toast each |
| Settings — Notifications | toggle | mutate notifications slice |
| | Save | `updateFounderProfile()`; toast |
| Settings — Roles | Switch to (active) | nav role dashboard |
| | Activate role (inactive) | nav role onboarding |
| | Sign out | toast `"Signed out (mock)"` |
| Onboarding | Continue → | persist + nav next |
| | ← Back | nav previous (state persisted) |
| | Step 6 Continue → | set `onboardingComplete: true`; nav `/dashboard`; toast |
| | Save & exit | persist; nav `/` |

## UserContext changes

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
  name: string; title: string; location: string;
  yearsBuilding: number; founderType: FounderExperience;
  headline: string; avatarUrl: string;
  // Step 2
  startupName: string; oneLiner: string; stage: FounderStage;
  industries: string[]; foundingYear: number; website: string; logoEmoji: string;
  // Step 3
  currentTeamSize: number; openRoles: OpenRole[];
  compensationOffered: CompModel; equityRangeMin: number; equityRangeMax: number;
  // Step 4
  launchStatus: LaunchStatus; users: number; revenueMonthly: number;
  fundingRaised: number; leadInvestor: string; nextMilestone: string;
  // Step 5
  whyBuilding: string; winningIn3Years: string;
  unfairAdvantage: string; ownershipPhilosophy: OwnershipPhilosophy;
  // Step 6
  links: { github: string; linkedin: string; twitter: string; personal: string };
  needsFromTechIT: string[]; pinnedWork: string[];
  // Status
  onboardingComplete: boolean;
  verification: FounderVerification;
  notifications: FounderNotificationPrefs;
}
```

Provider wiring:
1. `founderProfile` state in `UserProvider` with seed defaults (Sarah Chen / AI Task Manager / MVP / 240 users / `onboardingComplete: true` for dev convenience).
2. `updateFounderProfile()` with the same JSDoc'd shallow-merge contract as Collaborator.
3. Added to context value, exposed via `useFounderProfile()` hook.

`useActiveRoles()` updated to derive founder activity from `founderProfile.onboardingComplete` instead of the current always-active carve-out. Same pattern for the three other roles unchanged.

## Mock data (`founders/section/data/mockData.ts`)

New file with these exports:

- `signals: Signal[]` — 3 entries (applications / messages / investor activity) with `href` to source pages
- `tasks: FounderTask[]` — 3 entries (overdue / due-soon / this-week) with `href` to source pages
- `activeBuilds: Build[]` — 2 entries (primary + 1 side bet)
- `recentActivity: { id, buildName, buildLogo, message, timestampISO }[]` — 4 entries with `Date.now() - x` timestamps
- `journey: JourneyStage[]` — 5 stages (Idea complete, Team active 65%, MVP active 32%, Market upcoming, Launch upcoming)
- `endorsements: Endorsement[]` — 3 entries

All TypeScript interfaces are exported alongside the data so consumers can type-check.

## Shared modules

### `frontend/src/lib/roleRoutes.ts`

Moved from `frontend/src/dashboard/collaborators/section/components/collab/roleRoutes.ts`. Exports `roleDashboardPath` and `roleOnboardingPath` (`Record<Role, string>`). Collaborator's `TopBarRoleMenu.tsx` and `Settings.tsx` update their imports to point at `@/lib/roleRoutes`. The old file is deleted.

### `frontend/src/lib/formatRelative.ts`

Deduped from Collaborator's `Dashboard.tsx`. Exports `formatRelative(iso: string): string` → returns "just now" / "Xh ago" / "yesterday" / "Xd ago". Founder's `Dashboard.tsx` and `RecentActivity` component import from here; Collaborator's `Dashboard.tsx` imports from here too (inline copy removed).

## Visual tone rules

- **One accent color: violet-600.** Active sidebar item, primary buttons, journey active stage, next-milestone highlight. Nothing else.
- **Status colors:** soft tinted backgrounds — `slate-100/600` neutral, `emerald-50/700` healthy/verified, `amber-50/700` pending/warning, `red-50/700` overdue/critical. Never neon-bordered.
- **No emoji in UI text.** Startup logo emoji (🧠 / 🪙) renders from data (`founderProfile.logoEmoji`, `Build.logoEmoji`) — those are data, not chrome.
- **No animate-pulse, no gradient backgrounds, no neon edges.** Page entrance is `fade-in` at most.
- **Typography:** semibold for h2/h3, regular for body, mono only for IDs/code/handles.
- **Cards:** `border border-slate-200 bg-white rounded-xl`. No shadow except on Dialogs/Drawers.
- **Sidebar:** `bg-white`, `text-slate-700`, active `bg-violet-50 text-violet-700 border-l-2 border-violet-600`.
- **Numbers:** `tabular-nums` on every stat so columns align.
- **No AI branding** — no "AI Score", no "AI Insights", no "AI Verified" badge, no `🤖` icons.
- **No "Demo User"** — every name / initial reads from `founderProfile.name`.

## Toast library

`sonner` — already in tree. Mounted once in `FounderLayout`. Same approach Collaborator uses.

## Risks / open items

- **`incubationHub.tsx` Sidebar surgery** — removing the global `Sidebar` import + render is a tiny edit but the file is 873 lines and may have other coupling. The implementation plan includes a verification step that confirms it still renders inside `FounderLayout` without console errors before committing the Sidebar deletion.
- **`useActiveRoles` change behavior** — flipping Founder from "always active" to "iff `onboardingComplete`" could surprise existing flows. The default seed has `onboardingComplete: true` so the visible behavior is the same in dev; this only matters when someone explicitly flips it to false (e.g., to test the redirect).
- **Mock NIN auto-verify timer** — the 5s `setTimeout` flip from `pending` → `verified` is convenient for demo but easy to forget. Implementation comment must call this out so it's flagged for removal when a real verification API lands.

## Definition of done

- `/dashboard`, `/founder/profile`, `/founder/settings`, `/incubation-hub`, `/chat`, `/matchresults` all render inside `FounderLayout` without console errors.
- 6-step onboarding persists state; refresh on any step preserves data.
- `onboardingComplete` redirect bounces un-onboarded users to step 1.
- Every button in the master action map either navigates, opens a Dialog/Drawer, or mutates local state + toasts.
- Sidebar placeholders render as inert spans with `Soon` chips, not buttons.
- Top-bar role menu visible on all FounderLayout-wrapped pages; Switch-to / Activate destinations work.
- Sidebar Feed → `/feed`, Wallet → `/wallet`, Messages → `/chat`, Investors → `/matchresults`.
- Verification flags drive Profile badges and the `✓ Verified` checkmark.
- No "Demo User" / "DU" hardcoded anywhere; all reads are from `founderProfile.name`.
- `home.tsx`, `Sidebar.tsx`, founder setup/summary files deleted.
- `App.tsx` flat founder routes removed; legacy `/founder/setup` and `/founder/summary` redirect.
- Collaborator `roleRoutes.ts` and inline `formatRelative` deduped into `@/lib/*`.
- No emoji in UI headings outside startup-logo data.
- `tsc --noEmit -p tsconfig.app.json` error count ≤ 33 (current baseline at branch cut).
