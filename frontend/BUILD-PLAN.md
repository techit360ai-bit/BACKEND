# TechIT — Dashboard Gap Build Plan (frontend side: techIT)

Branch: `feat/dashboard-intelligence`. Paired backend branch: `feat/dashboard-backends`
in the `ai-router` repo (github.com/techit360ai-bit/ai-router).

Goal: close the gaps between the React dashboards and the ai-router intelligence
engine. The dashboards were 100% mock (zero API calls); this branch adds a real API
seam and wires each surface to the backend, with mock fallback so the UI still
renders offline.

## Build constraints (this environment)
- Vite cannot boot here (SIGBUS in WSL2 sandbox), so the app is NOT browser-verified
  here. Pre-existing `tsc -b` also reports ~234 errors on main (react-router
  resolution etc.), so a clean typecheck is not a reliable gate either. Work is
  written to match existing component patterns; verify with `npm run dev` on a real
  machine. Every commit states this.

## Architecture
- `src/lib/api/config.ts` — base URL (`VITE_API_BASE_URL`), `/api/v1` prefix, fallback flag.
- `src/lib/api/client.ts` — `apiGet`/`apiPost`/`withFallback` (native fetch, no new deps).
- `src/lib/api/<domain>.ts` — one typed module per backend domain (equity, payouts,
  capitalPools, dealRooms, dataRooms, investorReputation, heatmap, dealFlow, gsis,
  training, alerts, audio). Each exposes typed fetchers; screens call them via
  `withFallback(() => fetchX(), <existing mock>)` so nothing regresses offline.
- Existing `mockData.ts` files are kept as the fallback fixtures.

## Epics & status  (✅ done · 🚧 in progress · ⬜ todo)

### Section A — frontend exists, wire to new backend
- ✅ A1 Collaborator Equity — Equity.tsx wired to GET /collaborator/equity via lib/api/equity.ts (mock fallback). TODO minor: collab Dashboard.tsx equity card still reads mock directly.
- ✅ A2 Collaborator Earnings — Earnings.tsx wired to GET /collaborator/earnings + POST .../withdraw via lib/api/earnings.ts (mock fallback)
- ✅ A3 Investor Capital Pools — CapitalPools.tsx wired to GET /investor/capital-pools via lib/api/capitalPools.ts (fallback fixture)
- ✅ A4 Investor Deal Rooms — DealRooms.tsx (list) + DealRoom.tsx (detail: term sheet, valuation, milestones, documents, negotiation stepper) both wired to /investor/deal-rooms[/{id}] via lib/api/dealRooms.ts.
- ✅ A5 Investor Data Rooms — DataRooms.tsx summary stats + per-card compliance/AI-governance flags wired to GET /investor/data-rooms. (DataRoom.tsx detail metrics already reflect real startup fields; its illustrative docs have no backend content endpoint to wire to.)
- ✅ A6 Investor Reputation — Reputation.tsx fully wired (score, metrics, reviews, progression, leaderboard) to GET /investor/reputation via lib/api/investorReputation.ts
- ✅ A7 Investor Global Heatmap — GlobalHeatmap.tsx region avgReadiness wired to GET /investor/heatmap via lib/api/heatmap.ts (was hardcoded)

### Section B — backend exists, build/own the frontend surface
API modules created for ALL B domains (lib/api/{gsis,dealFlow,training,alerts,audio,workspace}.ts).
- ✅ B1 Deal Intelligence — DealIntelligence.tsx ranks startups by live EVI-I/WCRS (fetchDealFlow), with "ranked by EVI-I" indicator; mock order fallback.
- ✅ B2 Founder dashboard — GSIS master-score card wired into Dashboard.tsx via lib/api/gsis.ts (GET /dashboard/intelligence)
- ✅ B3 Adaptive Training — shared Academy.tsx surfaces adaptive plan (generateCurriculum) + reports progress (updateTrainingProgress). Benefits founder + collaborator.
- ✅ B4 Anomaly/stagnation alerts — founder Dashboard "Engine risk alerts" widget (runAnomalyScan over execution signals).
- ✅ B5 Audio briefing — founder Dashboard "Play momentum briefing" widget (fetchAudioBriefing, plays TTS audio).
- ✅ B6 Workspace AI — wired in the **new-frontend** repo, branch `feat/workspace-ai-wiring` (off feat/workspace-mcp): lib/api/workspaceAI.ts + Composer.tsx "Suggest tasks" chips calling /workspace/tasks/suggest. (lib/api/workspace.ts in this repo remains for any techIT-side workspace use.)

### Section C — LAST (per user)
- ⬜ C Idea & Solution Hub — full problem-driven pathway frontend

## Commit discipline
Commit after each coherent slice; update the status box above in the same commit so
progress survives session loss.
