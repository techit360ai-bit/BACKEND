# Messaging Branch Reconciliation

`origin/feat/messaging-backend` is an old branch from the frontend-era repository layout. It has no merge base with current `BACKEND/main` and stores the Go messaging service under `backend/`, alongside frontend files.

Current `BACKEND/main` already carries that major Go messaging work under `messaging-backend/`:

- direct messages, channels, feed, presence, and WebSocket transport
- demo room lifecycle, LiveKit token minting, and audience Q&A
- PostgreSQL migrations through `0006_demo_questions.sql`
- Redis fanout support
- unit, migration dry-run, and DB-backed integration CI jobs

The raw old branch must not be merged into `BACKEND/main` because it would try to replace the Node platform API in `backend/`, delete Plugins-MCP and production deployment docs, and reintroduce frontend-owned code into this repository.

The source of truth is:

- `backend/`: Node platform API and mounted Plugins-MCP backend
- `messaging-backend/`: Go messaging/feed/demo/Q&A/WebSocket service
- `frontend/`: reference-only migration material, not an active deploy surface

`npm run messaging:reconcile` enforces this topology so future reconciliation work does not regress to the old branch layout.
