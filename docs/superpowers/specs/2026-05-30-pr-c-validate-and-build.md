# PR-C: Validate & Build — Design

**Status:** Approved  
**Date:** 2026-05-30  
**Branch:** `feature/founders-foundation` (continues from PR-B's 12 commits)  
**Predecessor:** PR-B (Opportunity Hub + Hackathon shell) — see `2026-05-29-pr-b-opportunity-hub-and-hackathon-shell-design.md`  
**Successor:** PR-D (Submit & Pitch + judging) — separate spec

## Goal

Deliver the validation sprint and build-phase mechanics for hackathon teams: Submit Brief stage (7-field idea form), AI scoring (mock heuristics + canned critiques, 3 sub-scores), Build stage (on-demand check-in logging + timeline + reminder banner), Team Momentum Score (single 0-100 derived metric), and dashboard upgrade (Momentum visibility + dynamic next-action labels). After PR-C, a registered team can submit a brief, see their score breakdown, log check-ins during the build phase, and watch their momentum evolve on the dashboard.

## Non-goals

- Submit & Pitch stage — PR-D.
- Post-submission state (after final pitch submitted) — PR-D.
- Judging UI (org-side or founder-side results view) — PR-D.
- Real LLM scoring — PR-C uses deterministic heuristics + canned-critique strings. Real LLM integration is a later PR (E or beyond).
- Test framework — no test suite exists yet (per PR-B baseline). PR-C does not add one. Verification stays `tsc --noEmit` + tone audit + manual smoke test.
- Persistence beyond in-memory React context — matches PR-B. No localStorage, no backend. Refresh wipes state.
- Multi-team picker in the Hackathon panel — deferred. If a founder has >1 registration, the panel shows the most-recent one. Dropdown to switch between teams is a nice-to-have for PR-D.

## Architecture

### Data model additions

Three new types added to `frontend/src/contexts/UserContext.tsx`:

```ts
export interface IdeaBrief {
  problem:        string;  // 7 fields, all required, validated min 20 chars each
  targetUser:     string;
  solutionSketch: string;
  whyNow:         string;
  differentiator: string;
  risk:           string;
  successMetric:  string;
  submittedAt:    string;  // ISO timestamp; presence = locked (read-only)
}

export interface BriefScore {
  problemClarity: number;  // 0-100, three sub-scores
  innovationGap:  number;
  initialImpact:  number;
  overall:        number;  // weighted avg: 0.4*problemClarity + 0.3*innovationGap + 0.3*initialImpact
  critiques: {              // canned strings keyed to which field weakened which sub-score
    problemClarity: string[];
    innovationGap:  string[];
    initialImpact:  string[];
  };
  computedAt: string;       // pinned at submit; never re-runs
}

export interface CheckIn {
  id:        string;        // crypto-token (8-char base32, same pattern as invite tokens)
  loggedAt:  string;        // ISO timestamp
  status:    "on-track" | "blocked" | "pivoted";
  update:    string;        // 1-line, max 140 chars
  blocker?:  string;        // optional, only if status = "blocked"
}
```

Fields appended to the existing `HackathonRegistration` interface:

```ts
  brief?:      IdeaBrief;     // present once submitted; absence gates Build stage
  briefScore?: BriefScore;    // pinned at submit
  checkIns:    CheckIn[];     // default []
```

The existing `stage: "registered" | "submitted" | "building" | "submitted-final"` field already on the registration drives StagePill state:
- `registered` → Discover/Register completed, Brief active
- `submitted` → Brief completed, Build active (transitions on brief submit)
- `building` → Build active, first check-in logged (transitions on first check-in)
- `submitted-final` → PR-D (Submit & Pitch completed)

Two new updaters on `UserContext`:

```ts
submitBrief(teamId: string, brief: IdeaBrief, score: BriefScore): void;
  // Sets reg.brief, reg.briefScore, transitions stage to "submitted"

addCheckIn(teamId: string, checkIn: CheckIn): void;
  // Appends to reg.checkIns, transitions stage to "building" on first call
```

### New file layout

**Created:**

```
frontend/src/dashboard/_shared/hackathon/
  scoring.ts          # scoreBrief(brief: IdeaBrief): BriefScore — pure function
  momentum.ts         # computeMomentum(reg: HackathonRegistration, hackathon: Hackathon): MomentumResult
  critiques.ts        # canned-critique strings keyed by sub-score + signal

frontend/src/dashboard/founders/section/components/incubation/hackathon/
  BriefStage.tsx      # Submit Brief stage (replaces PR-B's ComingInPRC for stage="brief")
  BuildStage.tsx      # Build stage (replaces PR-B's ComingInPRC for stage="build")
```

**Modified:**

```
frontend/src/contexts/UserContext.tsx                                       (3 new types, 2 new updaters)
frontend/src/dashboard/founders/section/components/incubation/HackathonPanel.tsx  (wire BriefStage + BuildStage, add stage gating)
frontend/src/dashboard/founders/section/components/incubation/hackathon/RegisteredTeamCard.tsx  (add Momentum bar + dynamic next-action button)
frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx   (augment list rows with Momentum + next-action label)
```

Net: 5 created, 4 modified.

## Scoring logic

### `scoring.ts` — `scoreBrief(brief: IdeaBrief): BriefScore`

Pure function, deterministic, content-derived. Runs three independent rubrics over the 7 fields. Each rubric returns a 0-100 sub-score plus an array of critique strings drawn from `critiques.ts`. Overall = `0.4*problemClarity + 0.3*innovationGap + 0.3*initialImpact`.

**Rubric heuristics:**

1. **Problem Clarity** (reads `problem` + `targetUser`):
   - Length thresholds: ≥80 chars solid (+40), ≥40 partial (+20), <40 weak (+0)
   - Keyword presence: named user (+15), pain verbs ("struggle", "can't", "wastes", "lacks") (+15)
   - Specificity: numbers or proper nouns in `problem` (+15)
   - Target user concreteness: ≥30 chars in `targetUser` (+15)
   - Cap at 100

2. **Innovation Gap** (reads `differentiator` + `whyNow`):
   - Length thresholds: ≥80 chars solid (+35), ≥40 partial (+20), <40 weak (+0)
   - Comparison keywords in `differentiator`: "unlike", "vs", "instead of", "better than" (+20)
   - Urgency keywords in `whyNow`: "now", "shift", "until recently", "new", "changed" (+20)
   - Differentiator specificity: ≥60 chars (+15)
   - Cap at 100

3. **Initial Impact** (reads `solutionSketch` + `successMetric` + `risk`):
   - Solution concreteness: action verbs ("build", "connect", "automate") (+15), ≥60 chars (+15)
   - Measurable success: numbers/percentages/timeboxes in `successMetric` (+20)
   - Success metric length: ≥40 chars (+15)
   - Risk acknowledgment: ≥30 chars in `risk` (+20)
   - Cap at 100

Each rubric pulls 1-3 critique strings from `critiques.ts` based on which signals fired or didn't. Example critiques:
- `"Problem statement is short — name the specific user pain"`
- `"Differentiator doesn't compare to alternatives — what makes this unlike existing solutions?"`
- `"Success metric is vague — add a measurable target or timeframe"`

Critiques library is ~30 strings total, indexed by `{ rubric: "problemClarity" | "innovationGap" | "initialImpact", signal: string }`, stays in `critiques.ts` so `scoring.ts` has no copy.

### `momentum.ts` — `computeMomentum(reg, hackathon): MomentumResult`

Pure function, recomputed each render (depends on now-time / check-in count).

```ts
interface MomentumResult {
  score: number;                                    // 0-100
  nextAction: "submit-brief" | "log-check-in" | "build" | "complete";
  nextActionLabel: string;                          // human-readable, depends on state + time
}
```

**Score model:**
- Brief submitted: +25 (one-shot)
- Each check-in: +5, capped at +50 from check-ins (max 10 check-ins count)
- Filled member roles: +5 each, capped at +25 (max 5 members count)
- Idle decay: -1 per ≥6 hours since last check-in once Build started, floor at 0

**`nextAction` derivation:**
- No brief → `"submit-brief"`, label `"Submit brief to unlock Build"`
- Brief exists, 0 check-ins → `"log-check-in"`, label `"Kick off your first check-in"`
- Last check-in <4h ago → `"build"`, label `"On track — next check-in in <X>h"`
- Last check-in ≥4h ago → `"log-check-in"`, label `"Time for a check-in"`
- Stage `submitted-final` → `"complete"`, label `"Submitted ✓"`

Both functions are pure, no React, no context — easy to unit test when we add a test framework later.

## UI surfaces

### BriefStage.tsx

Two states:

**Pre-submit:**
- 7-field form, single column, max-w-2xl
- Each field: label + 1-line helper text + textarea/input + char count
- Validation: all 7 fields ≥20 chars to enable Submit button
- Live "Score preview" panel at bottom: runs `scoreBrief()` on every keystroke (debounced 200ms via useMemo), shows just the overall number + colored bar (emerald ≥70, amber 40-69, slate <40). No critiques shown until submit (avoids gaming).
- Submit button: disabled until all 7 fields valid; click → `submitBrief(teamId, brief, score)`, transitions stage to `submitted`, navigates to `?stage=build`

**Post-submit (locked):**
- Read-only summary card with the locked brief + full score breakdown
- 3 sub-score bars (Problem Clarity, Innovation Gap, Initial Impact) + critique lists below each
- No "Edit" button — locked is locked
- Footer: "Continue to Build →" button routes to `?stage=build`

### BuildStage.tsx

Two-column layout, max-w-6xl:

**Left column (timeline):**
- Reverse-chronological list of `CheckIn` entries
- Each entry: status pill (emerald/amber/violet for on-track/blocked/pivoted), relative timestamp, 1-line update, blocker note in slate-50 box if present
- Empty state if no check-ins: "No check-ins yet. Log your first one →"

**Right column (sticky form):**
- "Log check-in" form
- Status radio (3 options: on-track, blocked, pivoted)
- 140-char update textarea with counter
- Conditional blocker textarea (revealed when status = blocked)
- Submit → `addCheckIn(...)`, also transitions stage to `building` on first call
- Form clears on submit

**Above both columns:**
- Reminder banner shown when `momentum.nextAction === "log-check-in"` AND brief is submitted
- Amber-50 background, "Time for a check-in" + elapsed time since last check-in
- Dismisses on next check-in

### Dashboard.tsx upgrade

Each list row in the existing Hackathon Momentum card gets two new bits:

**Right-side column:**
- Momentum number (text-2xl, color-coded: emerald ≥70, amber 40-69, slate <40)
- Slim 0-100 bar (h-1.5) below the number

**Subtitle line:**
- Replaces the static `"Stage: Registered ──○──── Submit brief next"` PR-B placeholder
- Shows the `nextActionLabel` from `computeMomentum()`
- Actionable nudge: "Submit brief to unlock Build" / "Time for a check-in" / "On track — next check-in in 2h"

**"Manage team →" button:**
- Label changes dynamically based on `nextAction`:
  - `"submit-brief"` → "Submit brief →"
  - `"log-check-in"` → "Log check-in →"
  - Otherwise → "Open team"
- Same target: `/incubation-hub?panel=hackathon`

### HackathonPanel.tsx updates

The 5 stages already exist in PR-B. PR-C wires `brief` + `build` into real components:

```tsx
{activeStage === "discover" && <DiscoverStage />}
{activeStage === "register" && <RegisterStage />}
{activeStage === "brief"    && <BriefStage registration={reg} />}
{activeStage === "build"    && <BuildStage registration={reg} />}
{activeStage === "submit"   && <ComingInPRD stage="Submit & Pitch" icon={<Send />} />}
```

**Stage gating logic** in `activeStage` useMemo:
- If user navigates to `?stage=build` but `!reg.brief`, redirect to `?stage=brief` via `setSearchParams`, toast: `"Submit your brief first."`
- If user navigates to `?stage=brief` but brief is locked (`reg.brief.submittedAt` present), show the post-submit read-only view (no redirect — they can view the locked brief)

**StagePill state** derives from the registration:
- `stage === "registered"` → Discover/Register completed, Brief active
- `stage === "submitted"` → Brief completed, Build active
- `stage === "building"` → Build active (first check-in logged)
- `stage === "submitted-final"` → PR-D (Submit & Pitch completed)

### RegisteredTeamCard.tsx changes

Existing PR-B file, two additions:

**Metric line:**
- Gains Momentum score + slim bar (same styling as dashboard)

**Primary CTA:**
- The "Submit brief — coming in PR-C" disabled button is replaced with the dynamic next-action button (same logic as dashboard)

## Routing

No new routes. Everything inside the existing `/incubation-hub?panel=hackathon&stage=…` query model. The brief and build surfaces are reached via stage param (`brief`, `build`) — already wired in PR-B's `HackathonPanel`.

## Error handling

Three branches that need explicit treatment:

1. **Multiple registrations:** The panel currently shows one set of stages. PR-C defaults to the most-recent registration when there's >1. Single-registration users see no difference. Multi-registration dropdown is deferred to PR-D.

2. **Stage gating bypass via direct URL:** Redirect to `?stage=brief` (covered above). Toast message: `"Submit your brief first."`

3. **Score bands at boundaries:** All three sub-scores can hit 0 (extremely short brief). Submit is still allowed — Submit-button disabled rule is field-presence only, not score-quality. Founder owns the brief. Critiques explain what's weak.

## Verification

**Per-task gate:** Same as PR-B — `tsc --noEmit` from `frontend/` via the Windows node binary, baseline 31. No task may increase this count.

**End-of-plan tone audit:**

```bash
cd /home/faithsax/techIT/frontend/src
grep -rnE "animate-pulse|bg-gradient-to-(r|br)|from-violet-500|from-cyan|from-teal|from-rose|Demo User|🧠|🚨|💡|🤖|AI Insights|AI Score|AI Verified" \
  dashboard/_shared/hackathon \
  dashboard/founders/section/components/incubation/hackathon/BriefStage.tsx \
  dashboard/founders/section/components/incubation/hackathon/BuildStage.tsx \
  | grep -vE "logoEmoji|poster"
```

Expected output: empty (no matches). The grep excludes `MainIncubationPanel.tsx` (verbatim-moved from PR-A) and the PR-B files already audited.

**Manual smoke test** (post-merge):

1. From `/dashboard`, momentum list shows existing PR-B teams with new Momentum column + dynamic next-action label.
2. Click "Submit brief →" on a team → lands in BriefStage. Score preview updates as you type. All 7 fields filled → submit unlocks.
3. Submit → locked summary view appears with 3 sub-score bars + critiques. "Continue to Build →" routes to Build stage.
4. Build stage: timeline empty, form sticky on right. Log a check-in → appears in timeline, form clears, momentum on dashboard ticks up.
5. Wait long enough (or fake the clock) — reminder banner appears in Build, dashboard label changes to "Time for a check-in".
6. Status="blocked" reveals the blocker textarea; logged check-in shows the blocker note in slate-50.
7. Tone audit: no purple gradients, no animate-pulse, no AI overclaim copy ("Score" not "AI Score" — though we do compute it).

## Tech stack

Same as PR-B: React 19, react-router-dom, TypeScript, Tailwind, lucide-react, sonner (toasts), shadcn/ui primitives. No new dependencies.

## Tone & visual rules

Same as PR-B:
- Primary accent: `violet-600` only. No gradients.
- Status colors: `emerald-600` (on-track), `amber-600` (blocked), `violet-600` (pivoted), `slate-500` (closed).
- Badges: `bg-{color}-50 text-{color}-700 border border-{color}-200`.
- No `animate-pulse`. Loading states use static skeletons.
- No emoji in `<h1>` / `<h2>`. The `poster` field on opportunities is data, rendered in plain spans/divs.
- No "Demo User." Leader name from `founderProfile.name`.
- No `Date.now()` / `Math.random()` directly in render bodies. Wrap in `useMemo` or compute at module load. Inside event handlers, they're allowed.

## Implementation notes

- The brief form's 7 fields are all `<textarea>` (not `<input>`) to allow multi-line input. Each has `rows={3}` and auto-expands via Tailwind `resize-y`.
- The score preview debounce is 200ms via `useMemo` with a dependency array on the 7 field values. No external debounce library needed.
- The check-in form's 140-char limit is enforced via `maxLength` on the textarea. Char counter shows `{update.length}/140`.
- The reminder banner's "elapsed time" is computed via `Date.now() - new Date(lastCheckIn.loggedAt).getTime()` and formatted as "Xh Ym ago". Recomputed each render (no useMemo — it's cheap).
- The momentum idle-decay logic uses the same elapsed-time calc. Decay is -1 per 6h, so a 24h gap = -4 points.
- The `crypto.getRandomValues` pattern for check-in IDs matches the invite-token generation from PR-B's `RegisterStage.tsx`.

## Handoff to PR-D

After PR-C, the registration has:
- `brief` (locked)
- `briefScore` (pinned)
- `checkIns[]` (timeline of build activity)
- `stage === "building"` (or `"submitted"` if no check-ins yet)

PR-D adds:
- Submit & Pitch stage (final submission form: demo link, pitch deck, video)
- Transition to `stage === "submitted-final"`
- Post-submission state (read-only view of the full submission)
- Judging UI (org-side or founder-side results view)

The momentum score continues to evolve in PR-D (final submission adds +X points), but the core mechanics are PR-C's.
