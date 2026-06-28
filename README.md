# TECHIT Backend

`BACKEND` owns the platform backend services:

- `backend/`: Node API for auth, users, and the mounted Plugins-MCP backend.
- `backend/` on branch `feat/messaging-backend`: Go messaging service source after the messaging merge.
- `Plugins-MCP/`: MCP plugin backend used by workspace tool-calling.

`frontend/` in this repo is migration/reference material only. The active React/Vite frontend lives in the separate `new-frontend` repo, and frontend fixes should be moved there before review/deploy.

## Local Development

```bash
cd backend
npm install
npm test
```

For Go messaging work, use the messaging branch and run Go commands from `backend/`.

## CI and Deployment

- `.github/workflows/backend.yml` covers the Go messaging backend branch.
- The old frontend deploy workflow is disabled because frontend CI/deploy now belongs to `new-frontend/.github/workflows/frontend.yml`.
- Plugins-MCP is mounted by the Node API and shares the platform JWT verification path.
