# PR-B: Opportunity Hub + Hackathon shell — Design

**Status:** Approved
**Date:** 2026-05-29
**Branch:** `feature/founders-foundation` (next sub-branch from this base)
**Predecessor:** PR-A (Founders foundation) — 11 commits ahead of `main`, see `2026-05-28-founders-foundation-design.md`
**Successor:** PR-C (hackathon validation sprint + momentum mechanics — separate spec)

## Goal

Deliver the founder-side Opportunity Hub and the hackathon team-formation flow end-to-end: browse opportunities published by Organizations → register a team for a hackathon → share an invite link → accept invites → find collaborators filtered by hackathon. Refactor the 873-line `incubationHub.tsx` into a layout with an internal sidebar that toggles between the existing Main Incubation surface and a new Hackathon panel. The deep validation/scoring/momentum mechanics defer to PR-C.

## Non-goals

- AI scoring (Problem Clarity Score, Innovation Gap Score, Initial Impact Score) — PR-C.
- The 7-field idea-submission brief — PR-C.
- 4-hour check-ins, Team Momentum Score, dashboard momentum tracker beyond stage display — PR-C.
- Org-side flows for publishing programs, funding calls, or events — out of scope. PR-B uses mock catalog data.
- Real backend for invite-token validation, team membership, or persistence beyond the in-memory FounderProfile context — PR-D or later.
- Decomposing the Main Incubation panel into smaller components — pure refactor, no user-visible benefit, deferred.
- The remaining two sidebar placeholders (Idea Hub, Market Pathway).

## Architecture

### Routing

New routes, all inside `<Route element={<FounderLayout />}>`:

```
/opportunity-hub                    → OpportunityHub
/opportunity-hub/:opportunityId     → OpportunityDetail
/h/:hackathonId/team/:teamId        → InviteAcceptPage   (?token=<8-char> required)
```

Existing `/matches` reused with query string `?hackathon=<id>` for hackathon-aware filtering.

`/incubation-hub` accepts an optional `?panel=hackathon` query string to deep-link the inner sidebar to the Hackathon panel; defaults to Main Incubation when absent.

### File layout

**Created:**

```
frontend/src/dashboard/_shared/opportunities/
  types.ts
  data.ts

frontend/src/dashboard/founders/section/components/incubation/
  IncubationLayout.tsx
  MainIncubationPanel.tsx
  HackathonPanel.tsx
  hackathon/
    DiscoverStage.tsx
    RegisterStage.tsx
    RegisteredTeamCard.tsx
    StagePill.tsx

frontend/src/dashboard/founders/section/components/founder/
  OpportunityHub.tsx
  OpportunityCard.tsx
  OpportunityDetail.tsx
  InviteAcceptPage.tsx
```

**Modified:**

```
frontend/src/dashboard/incubationHub.tsx                                    (becomes 5-line shim)
frontend/src/App.tsx                                                        (4 new routes + imports)
frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx    (Hackathon Momentum card data-aware)
frontend/src/dashboard/founders/section/components/founder/FounderLayout.tsx (Opportunity Hub entry enabled)
frontend/src/dashboard/matchResults.tsx                                     (?hackathon banner + filtering + invite CTA)
frontend/src/dashboard/organization/section/components/org/Hackathons.tsx   (imports from shared module)
frontend/src/contexts/UserContext.tsx                                       (HackathonRegistration + updaters)
```

Net: 13 created, 7 modified.

## Data model

### Shared opportunity types — `_shared/opportunities/types.ts`

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
  applyDeadline: string;        // ISO date — drives "closing-soon" within 72h
  publishedAt: string;          // ISO date — recency sort
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

`OpportunityBase` is internal. Discriminant is `type` — consumers narrow with `if (opp.type === "hackathon")`.

### Mock catalog — `_shared/opportunities/data.ts`

- **4 hackathons** — port the existing 4 from `Org's Hackathons.tsx` verbatim (AI for Africa 2026, Climate Builders Q2, FinTech Fast Track, HealthX Spring), mapped to the unified shape.
- **3 programs** — TechStars Tools cohort (12-week accelerator), African Builders Fellowship (6-month incubator), Sequoia Spark Mentorship (3-month 1:1).
- **4 funding/RFPs** — Google for Startups Africa Cloud Credits, MTN Y'ello Pilot RFP, Visa FinTech Fast-Track grant, MIT Solve Climate Challenge.
- **3 events** — YC Demo Day Watch Party, Lagos Founder AMA w/ Iyin Aboyeji, Stripe ATL Workshop.

`Hackathons.tsx` (Org side) imports the hackathon array and projects to its existing local `HackathonListItem` shape inline. Single source of truth, no drift.

### FounderProfile additions — `UserContext.tsx`

```ts
export interface HackathonRegistration {
  hackathonId: string;
  teamId: string;             // generated client-side: "team_<6-char>"
  teamName: string;
  role: "leader" | "member";  // PR-B: founder is always "leader"
  inviteToken: string;        // 8-char base32, mock-static
  registeredAt: string;
  members: HackathonTeamMember[];
  openRoles: OpenRole[];      // copied from FounderProfile.openRoles at registration
  stage: "registered" | "submitted" | "building" | "submitted-final";
  rosterClosed?: boolean;     // local UI flag, no backend
}

export interface HackathonTeamMember {
  collaboratorId: string;
  name: string;
  role: string;
  acceptedAt: string;
}

interface FounderProfile {
  // ...existing fields...
  hackathonRegistrations: HackathonRegistration[];
}
```

New context updaters (both wrap `setFounderProfile` with proper spread to avoid the shallow-merge gotcha caught in PR-A):

```ts
registerForHackathon(reg: HackathonRegistration): void;
addHackathonMember(teamId: string, m: HackathonTeamMember): void;
toggleRosterClosed(teamId: string): void;
```

Default `hackathonRegistrations: []` in the context's initial profile.

### Invite-token generation

Tokens generated client-side at registration using `crypto.getRandomValues` + base32 (8 chars). Persisted to `HackathonRegistration.inviteToken`. Real validation/server issuance is backend work — flagged in this spec as PR-D scope.

## UX

### Opportunity Hub — `/opportunity-hub`

**Layout:** featured + grid (2 columns desktop; stacked mobile).

- Featured slot (left, 60%): the single `featured: true` opportunity matching the active type filter. Falls back to the most recent `open` if none flagged. Hand-picked editorially via `featured: true`.
- Grid (right, 40%): all other matching opportunities. Sort: Open → Closing-soon → Closed; secondary sort by `applyDeadline` ascending.

**Filter bar:**
- Type pills: `All · Hackathons (n) · Programs (n) · Funding (n) · Events (n)`. Default `All`. Counts after filter.
- Status dropdown: `All · Open · Closing soon · Closed`. Default `Open`.
- Search box: client-side filter over `title + organizer.name + tags`. Debounced 200ms.

**Card design (`OpportunityCard.tsx`):** type-aware via discriminated union, single component.
- Visual hook: `poster` field renders top-left.
- Type chip: uppercase 10px top-right, slate-700 on slate-100.
- Body: 2-line summary + one type-specific metric line:
  - Hackathon: `{prizePool} · {durationHours}h · {registrants} registered`
  - Program: `{format} · {durationWeeks} weeks · Cohort {cohortSize}`
  - Funding: `{amountRange} · {equity ? "Equity" : "Non-dilutive"}`
  - Event: `{format} · {durationMinutes}min · {isVirtual ? "Virtual" : hostedBy}`
- Footer: status chip + countdown (`Closes in 6 days` / `Closes today` / `Closed`) + primary CTA.
- Primary CTA by type:
  - Hackathon → `Register team →` routes to `/incubation-hub?panel=hackathon&h=<id>&stage=register`.
  - Program / Funding / Event → respective verb (`Apply →` / `Apply →` / `RSVP →`) routes to `/opportunity-hub/:id` (generic detail; inert apply button — flagged for future PR).

**Empty states:**
- No matches for filter: "No {type} opportunities open right now. Check back soon, or {Link: browse all}."
- No featured + no grid: "Organizations haven't published any opportunities yet."

### Opportunity Detail — `/opportunity-hub/:id`

- Hackathon detail focus: full opportunity card expanded + a `Register team` CTA that routes into the Hackathon Panel's Register stage.
- Other types: generic detail card with key fields + inert apply CTA, plus a footer note "Application flow coming soon."

### Incubation Hub layout — `IncubationLayout.tsx`

Internal sidebar (64px wide) between Founder sidebar and content.

```
┌──────────┬────────┬─────────────────────────────────────────┐
│ Founder  │ Inner  │  Active panel content                   │
│ sidebar  │ ┌────┐ │                                         │
│          │ │Main│ │  MainIncubationPanel                    │
│          │ └────┘ │  OR HackathonPanel                      │
│          │ ┌────┐ │                                         │
│          │ │Hack│ │                                         │
│          │ └────┘ │                                         │
└──────────┴────────┴─────────────────────────────────────────┘
```

- Main pill: Brain icon (lucide). Hackathon pill: Trophy icon.
- Active pill: `border-l-2 border-violet-500 bg-violet-50 text-violet-700`. Inactive: `text-slate-600 hover:bg-slate-50`.
- Hackathon pill shows `bg-amber-100 text-amber-700` count badge when registrations > 0.
- State: `useState<"main" | "hackathon">`. Initial value reads `?panel=hackathon` query string; otherwise `"main"`. No URL change on toggle (panel state is local, query string only used for deep-link entry).
- `incubationHub.tsx` becomes a 5-line shim that re-exports `IncubationLayout` as the default export. Existing route in `App.tsx` (`<IncubationHub />`) keeps working.

### MainIncubationPanel

The existing 873-line content moved verbatim. No structural decomposition. Keeps `activeNav`, `copilotText`, `isDocPreviewOpen`, structured idea form, all 16 nav items. The only change is removing the outer page wrapper that's now in `IncubationLayout`.

### HackathonPanel — 5-stage pipeline

Pill strip at top: `Discover → Register → Submit Brief → Build → Submit & Pitch`.

- Active pill: `border-violet-500 bg-violet-50`. Completed: `border-emerald-500 bg-emerald-50` with tick. Hairline dashes between pills.
- PR-B implements **Discover** and **Register**. Submit Brief / Build / Submit & Pitch render an empty state: "Coming in PR-C. The validation sprint, build phase, and submission flow go live next." with soft slate icon and same outer card chrome.

#### Discover stage

**No registrations:** hero card "Find a hackathon to join" + grid of mocked hackathons (using `OpportunityCard`). Each card's CTA routes to `/incubation-hub?panel=hackathon&h=<id>&stage=register`. Footer link `Browse all opportunities → /opportunity-hub`.

**One or more registrations:** top section shows `RegisteredTeamCard` for each. Each card displays team name, hackathon, member count vs. team size, days until start, CTAs:
- `Manage team →` opens inline drawer (right slide).
- `Find collaborators →` routes to `/matches?hackathon=<id>`.
- `Continue →` advances to next stage — in PR-B always disabled with label "Submit brief — coming in PR-C".

Below registered teams: "Other open hackathons" with hackathons not yet registered for.

**Manage team drawer:** team name + hackathon header, member roster (leader + accepted + open role ghost rows), invite link with copy button, mock "Remove member" button (updates local `members`), close-roster toggle (sets `rosterClosed: true` — closed teams' invite link page shows "team is full").

#### Register stage — `RegisterStage.tsx`

Triggered by URL `?h=<hackathonId>&stage=register`. If `?h=` missing, redirect to Discover with banner.

**Form:**
1. Pick the hackathon (skipped if `?h=` present).
2. Team setup:
   - Team name (≥3 chars, required)
   - Team size (radio: 2 / 3 / 4 / 5)
   - Roles needed: checkboxes pre-populated from `FounderProfile.openRoles`, plus inline "Add role" mini-form (title + skill tags). At least one role required.
3. Confirm & generate invite link.

**On confirm:**
- Generate `teamId = "team_" + 6-char base32`, `inviteToken = 8-char base32`.
- Call `registerForHackathon` with `role: "leader"`, copying selected roles into `openRoles`.
- Render success card with shareable URL `https://techit.ai/h/<hackathonId>/team/<teamId>?token=<token>`, Copy button, "Send to collaborators →" modal (Copy / mailto: prefilled / `wa.me/?text=` link), and "Find Hackathon Collaborator →" link to `/matches?hackathon=<id>`.

**Inline validation:** team name length, ≥1 role checked, size 2–5. No toast spam.

### Invite Accept Page — `/h/:hackathonId/team/:teamId?token=<8-char>`

**Lookup logic (PR-B mock):**
1. Read params + token from query string.
2. Search `founderProfile.hackathonRegistrations` for matching `hackathonId + teamId`.
3. Token mismatch → "This invite link is invalid or has expired."
4. Not found → "We can't find that team. The invite link may be from a hackathon you're not signed in for."
5. Team full (`members.length >= teamSize`) → "This team is already full. Find another team in the hackathon →" linking to `/opportunity-hub/<hackathonId>`.
6. Visiting user is the leader → "You're the leader of this team — share the link with collaborators instead." with copy-link button. **Leader detection in PR-B:** the visitor is treated as the leader when `founderProfile.hackathonRegistrations` contains a registration whose `teamId` matches the URL's `:teamId`. Real cross-user identity is PR-D.
7. `rosterClosed === true` → "This team's roster is closed."
8. Otherwise → render the invite acceptance UI.

**UI:**
- Hackathon header (poster, title, organizer, dates).
- Team header (name + leader name from FounderProfile).
- Current members (with leader marked).
- Open roles list (filtered to unfilled).
- Role-picker dropdown of unfilled roles. Auto-selected and read-only if only one remains.
- Decline + Join CTAs.

**Join action:**
- Calls `addHackathonMember(teamId, { collaboratorId: "mock_self", name: "Sample Collaborator", role: selectedRole, acceptedAt: now })`.
- Filled role removed from `openRoles`.
- Routes to `/incubation-hub?panel=hackathon` with success toast `"Joined {teamName} for {hackathonTitle}."` Hackathon panel auto-opens to that team's row.

**Decline action:**
- Routes to `/opportunity-hub` with toast `"Invite declined."`. No state change.

**Identity caveat:** unauthenticated mocks mean the joining "user" is the same FounderProfile in context. Synthetic `HackathonTeamMember` with `collaboratorId: "mock_self"`, `name: "Sample Collaborator"` lets the leader's view show a member appearing — but real multi-user is PR-D.

### `/matches?hackathon=<id>` integration

When `?hackathon=<id>` present:

**Banner** (above existing header): `bg-amber-50 border border-amber-200 text-amber-900`:
> 🏆 Filtering for {Hackathon title}
> Showing collaborators available {dates}, in roles you listed for team {teamName}.
> [Clear filter ✕] → routes to `/matches`

**Filtered cards:** mock-filter existing match cards by matching role tags against the registration's `openRoles`. Existing card chrome unchanged.

**Card primary CTA changes from `Connect` to `Invite to {teamName}`.** Click adds via `addHackathonMember`, marks role filled, success toast. Card greys out + checkmarked: `Invited`.

**Empty state for filtered list:** "No collaborators match the open roles for this hackathon. Try widening your role list or sharing the invite link directly."

**Unknown hackathon:** soft warning banner + empty state. Don't break the page.

**No `?hackathon=`:** existing behavior unchanged.

**Entry points to this URL:** Discover stage's `Find collaborators →`, Manage Team drawer's `Find more collaborators →`, Register stage's success card.

### Founder Dashboard wire-up

`Dashboard.tsx` Hackathon Momentum card (currently lines 254-273):

**No registrations:** existing empty-state copy stays. CTA "Browse opportunities →" becomes active (remove disabled styling + Soon chip), routes to `/opportunity-hub`.

**One or more registrations:** card switches to list view. Each row reads from a `HackathonRegistration` joined with the matching `Hackathon` from the shared catalog (lookup by `hackathonId`):
- Poster + hackathon title
- Team name · `{members.length} of {teamSize}` members · `Starts in {N} days` (or `Starts {date}` if >7 days)
- Mini stage strip (compact `StagePill`): `Stage: Registered  ──○──────  Submit brief next` (next-stage chevron is soft slate placeholder until PR-C)
- `[Manage team →]` button routes to `/incubation-hub?panel=hackathon` and auto-opens the Manage drawer for that team.

Footer: `[Browse more opportunities →]` to `/opportunity-hub`.

### Founder sidebar wire-up

`FounderLayout.tsx` — Opportunity Hub entry: remove `disabled` and `Soon` chip, set `to="/opportunity-hub"`, icon stays `Compass`. Active highlight handles `/opportunity-hub` and `/opportunity-hub/:id` via `useMatch`. Idea Hub and Market Pathway placeholders stay disabled.

## Tone & visual rules

- Primary accent: `violet-600` only. No gradients.
- Status colors: `open = emerald-600`, `closing-soon = amber-600`, `closed = slate-500`. Solid swatches.
- Badges: `bg-{color}-50 text-{color}-700 border border-{color}-200`.
- Type chips: uppercase 10px, `slate-700` on `slate-100`. No type-specific colors — keeps catalog visually unified.
- No `animate-pulse`. Loading states use static skeletons (`bg-slate-100 rounded`).
- No emoji in `<h1>` / `<h2>`. The `poster` emoji is data, not chrome.
- No "Demo User." Leader name from `founderProfile.name`. Mock collaborator on InviteAcceptPage is `Sample Collaborator` — explicit, not "Demo User."

## Verification gates (every commit)

```bash
cd /home/faithsax/techIT/frontend
"/mnt/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```

**Baseline at branch cut: 31** (current PR-A HEAD). PR-B must hold ≤31. Lower is fine.

```bash
"/mnt/c/Program Files/nodejs/node.exe" node_modules/eslint/bin/eslint.js \
  src/dashboard/_shared/opportunities \
  src/dashboard/founders/section/components/incubation \
  src/dashboard/founders/section/components/founder/OpportunityHub.tsx \
  src/dashboard/founders/section/components/founder/OpportunityCard.tsx \
  src/dashboard/founders/section/components/founder/OpportunityDetail.tsx \
  src/dashboard/founders/section/components/founder/InviteAcceptPage.tsx
```

Must run clean on new files. `react-hooks/purity` rule applies — no `Date.now()` / `Math.random()` direct in render bodies. Wrap in `useMemo` or compute at module load.

**Tone audit (final task):**

```bash
cd /home/faithsax/techIT/frontend/src
grep -rnE "animate-pulse|bg-gradient-to-(r|br)|from-violet-500|from-cyan|from-teal|from-rose|Demo User|🧠|🚨|💡|🤖|AI Insights|AI Score|AI Verified" \
  dashboard/_shared/opportunities \
  dashboard/founders/section/components/incubation \
  dashboard/founders/section/components/founder/OpportunityHub.tsx \
  dashboard/founders/section/components/founder/OpportunityCard.tsx \
  dashboard/founders/section/components/founder/OpportunityDetail.tsx \
  dashboard/founders/section/components/founder/InviteAcceptPage.tsx \
  | grep -vE "logoEmoji|poster" || echo "OK: clean"
```

Allowed exceptions: `poster` (intentional emoji-as-data), `logoEmoji` on organizers. Everything else must be `OK: clean`.

## Commit cadence

Estimated 10–12 commits, each independently verified:

1. Shared opportunities types + data module
2. UserContext: HackathonRegistration types + updaters + initial-profile defaults
3. IncubationLayout + sidebar split: move existing content into MainIncubationPanel verbatim, incubationHub.tsx becomes a shim
4. HackathonPanel shell + StagePill + 5-stage empty states
5. DiscoverStage + RegisteredTeamCard + Manage Team drawer
6. RegisterStage form + invite-link generation
7. OpportunityHub page + OpportunityCard
8. OpportunityDetail page (hackathon detail focus + generic stub for other types)
9. InviteAcceptPage with all 8 lookup-state branches
10. /matches integration: ?hackathon banner + filtered cards + Invite CTA
11. Dashboard wire-up (data-aware Momentum card + sidebar entry enable)
12. Tone audit + final verify

The implementation plan refines this with per-task acceptance criteria and verification commands.

## Risks & mitigations

- **Breaking IncubationHub** — the file is 873 lines and core to the Founder experience. Mitigation: Task 3 moves content verbatim, no logic changes, full smoke test before subsequent tasks layer in.
- **Org Hackathons.tsx integration** — touching another role's file. Mitigation: only the import + projection is changed; no UI alterations to the Org page. Org-side smoke test included in Task 1.
- **State shape changes to FounderProfile** — Task 2 ships before any consumer needs the new fields. Defaults to `[]` so existing PR-A code keeps working unchanged.
- **Mock identity on InviteAcceptPage** — explicit `"Sample Collaborator"` synthetic member documented as known-mock; PR-D wires real auth.
- **`/matches` page already at 870+ lines** — adding the `?hackathon=` branch risks tangle. Mitigation: extract the new banner + filter logic into a small adjacent helper (`HackathonMatchBanner.tsx`) rather than inflating `matchResults.tsx` further.

## Open questions deferred to PR-C

- Idea-submission brief field shape and validation gates.
- AI scoring rubrics (Problem Clarity / Innovation Gap / Initial Impact).
- Team Momentum Score formula and 4-hour check-in cadence.
- The "Workspace" handoff icon and what it routes to after team formation.

## Approvals

- 2026-05-29 — design approved by user across all 6 sections (routing/files, data model, Opportunity Hub UX, Hackathon Panel + registration, invite + matches, dashboard + tone + verification).
