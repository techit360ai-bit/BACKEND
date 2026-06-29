# TECHIT Backend

`BACKEND` owns the platform backend services:

- `backend/`: Node API for auth, users, and the mounted Plugins-MCP backend.
- `messaging-backend/`: Go messaging, feed, demo room, Q&A, and WebSocket service.
- `Plugins-MCP/`: MCP plugin backend used by workspace tool-calling.

`frontend/` in this repo is migration/reference material only. The active React/Vite frontend lives in the separate `new-frontend` repo, and frontend fixes should be moved there before review/deploy.

## Local Development

```bash
cd backend
npm install
npm test
```

For Go messaging work:

```bash
cd messaging-backend
go test ./... -short -timeout 30s
DATABASE_URL=postgres://postgres:postgres@localhost:55432/techit_msg?sslmode=disable go run ./cmd/migrate -mode=dry-run
```

## CI and Deployment

- `.github/workflows/backend.yml` covers the Node backend, Plugins-MCP mount dependencies, and Go messaging service.
- The old frontend deploy workflow is disabled because frontend CI/deploy now belongs to `new-frontend/.github/workflows/frontend.yml`.
- Plugins-MCP is mounted by the Node API and shares the platform JWT verification path.
