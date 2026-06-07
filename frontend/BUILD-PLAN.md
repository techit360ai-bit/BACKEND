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
- 🚧 A4 Investor Deal Rooms — DealRooms.tsx (list) wired to GET /investor/deal-rooms via lib/api/dealRooms.ts. TODO: DealRoom.tsx detail still computes valuation locally (backend endpoint + fetchDealRoom() ready to wire).
- 🚧 A5 Investor Data Rooms — DataRooms.tsx summary stats wired to GET /investor/data-rooms via lib/api/dataRooms.ts. TODO: per-card flags + DataRoom.tsx detail still read mock directly.
- ✅ A6 Investor Reputation — Reputation.tsx fully wired (score, metrics, reviews, progression, leaderboard) to GET /investor/reputation via lib/api/investorReputation.ts
- ✅ A7 Investor Global Heatmap — GlobalHeatmap.tsx region avgReadiness wired to GET /investor/heatmap via lib/api/heatmap.ts (was hardcoded)

### Section B — backend exists, build/own the frontend surface
- ⬜ B1 Deal Intelligence — wire to EVI-I/deal-flow ranking
- ⬜ B2 Founder dashboard — surface real GSIS + venture-pipeline outputs
- ⬜ B3 Adaptive Training — wire AcademyPage + founder training
- ⬜ B4 Anomaly/stagnation alerts — surface on dashboards
- ⬜ B5 Audio briefing — momentum audio widget
- ⬜ B6 Workspace AI — review_code / plan_sprint / suggest_tasks into console

### Section C — LAST (per user)
- ⬜ C Idea & Solution Hub — full problem-driven pathway frontend

## Commit discipline
Commit after each coherent slice; update the status box above in the same commit so
progress survives session loss.
