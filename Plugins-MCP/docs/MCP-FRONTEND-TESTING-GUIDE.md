# MCP Layer — Frontend Testing Guide

How to start the stack locally and prove the MCP layer works from the browser.

Everything below runs on **fake connectors**. No GitHub, Notion, Figma, or Web3
credentials are needed, and nothing leaves your machine. See
[§9 What dev does and does not prove](#9-what-dev-does-and-does-not-prove).

---

## 1. Start the two apps

They are two separate repos. Neither command starts the other.

**Terminal 1 — backend (port 3000):**

```bash
cd BACKEND/backend
npm run dev
```

Expect `TechIT API running on PORT 3000`.

**Terminal 2 — the frontend that has the dashboard (port 5173):**

```bash
cd new-frontend/frontend
npm run dev
```

Expect `Local: http://localhost:5173/`.

> **Why not the monorepo's `npm run dev`?** `BACKEND/package.json`'s `dev` script
> starts `BACKEND/backend` **and `BACKEND/frontend`**. `BACKEND/frontend` has no
> `/plugins` route — that dashboard lives only in `new-frontend/frontend`
> (`src/App.tsx:196`), which is a separate repo outside the workspace list. Run
> them as two terminals above.

> **Nothing else needs starting — in particular, not the ai-router.**
> The `ai` connector defaults to an in-process fake
> (`AI_HARNESS_CONNECTOR_MODE` unset), and its token resolver falls back to a
> placeholder even with an empty vault — so it is the one connector that answers
> with no credential and no network. `ai-router` (FastAPI, :8000) is a *caller*
> of this API, not a dependency of it. Only
> `AI_HARNESS_CONNECTOR_MODE=real` + `AI_ROUTER_URL` reaches it, and then only
> `review_code` has a live route (§9 of the runbook). No `npm` command starts it,
> and none is needed here.

### First-time setup

- **Backend** needs `BACKEND/backend/.env`. It is git-ignored; if it is missing,
  recreate it with at least:
  ```
  NODE_ENV=development
  PORT=3000
  FRONTEND_URL=http://localhost:5173
  JWT_SECRET=<64 hex chars>
  DB_DRIVER=json
  MCP_ENABLED=true
  MCP_STORE=file
  MCP_SEED_DEMO_ACTIVITY=true
  MCP_APPROVAL_TTL_MS=900000
  ```
  Do **not** set `MCP_ENABLED_CONNECTORS` (unset = all 7 connectors) or
  `*_CONNECTOR_MODE=real` (unset = fake connectors), and keep `NODE_ENV` off
  `production`/`staging`.

- **Email/OTP: leave `RESEND_API_KEY` unset.** Signup is gated on email
  verification, so `POST /api/auth/send-otp` needs *some* way to deliver a code.
  In development the backend does not email it — it prints it to its own
  terminal (`src/controllers/otpController.js`):

  ```
  [dev-otp] you@example.com -> 415204
  ```

  Read the code there and type it into the wizard. The guard is an allowlist on
  `NODE_ENV === 'development'` **and** an absent key, so every other environment
  keeps the original fail-closed behaviour: without `RESEND_API_KEY`,
  production/staging/test still answer `502 Failed to send email`. Set a real
  key only if you want real mail — and note Resend's default sender
  (`onboarding@resend.dev`) delivers only to the account owner's own address, so
  expect to verify a domain before it reaches anyone else.

  **Not covered:** the password-reset email (`/api/auth/forgot-password`) goes
  through the same `getResend()` and has no dev fallback, so that flow still
  502s locally.

- **Frontend** needs no `.env`. `src/lib/techitApi.ts:15` defaults to
  `http://localhost:3000/api/mcp`.

- **Install** (from each repo root):
  ```bash
  cd BACKEND && npm install
  cd new-frontend/frontend && npm install
  ```
  No flags needed. This used to require `--legacy-peer-deps`, because
  `package.json` had conflicting duplicate keys and an impossible
  `vitest@5` + `vite@5` pair — both fixed, see §11.

---

## 2. Sign in and reach the page

1. Open <http://localhost:5173> and sign in with your own account.
2. Go to <http://localhost:5173/plugins>.

**Creating an account.** The wizard is four steps and will not complete without
a verified email, so `send-otp` has to succeed first — see the `RESEND_API_KEY`
bullet in §1. Pick the **Founder** or **Organisation** role; those are the only
two that reach `/plugins` (§2 above), and `app.js` maps both to MCP `owner`,
which is what the approval gate requires. Any other role signs up fine but is
redirected away from the dashboard.

To create one from the CLI instead — useful when you only need a token:

```bash
# 1. request a code, then read the `[dev-otp] ... -> NNNNNN` line from the
#    backend terminal
curl -s -X POST localhost:3000/api/auth/send-otp \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com"}'

# 2. exchange the code for a one-time verification token
curl -s -X POST localhost:3000/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","code":"NNNNNN"}'

# 3. sign up with that token (role founder|organisation reaches /plugins)
curl -s -X POST localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"…","firstName":"A","lastName":"B",
       "role":"founder","emailVerificationToken":"<from step 2>"}'
```

Do steps 1–3 in one sitting: the code expires after 10 minutes
(`OTP_EXPIRES_MINUTES`) and `/send-otp` is rate-limited to 3 per 10 minutes per
IP, while `/verify-otp` allows 20.

**The route is guarded** (`src/components/RequirePluginsAccess.tsx`). It admits
only `profile.role === "founder"` or `"organisation"`. Anything else redirects
home; signed out redirects to `/signin`. Those two roles are exactly the ones
`app.js` maps to MCP `owner`, which is the role the approval gate requires.

If you land back on the home page, your account's role is not `founder` /
`organisation` — that is the guard working, not a bug.

---

## 3. Read the dashboard

| Area | What it tells you |
|---|---|
| Stat cards | Tool count, connectors, pending approvals, recent activity |
| Catalogue | All **34 tools** across **7 connectors**, with a **gate chip** on the 9 destructive ones |
| Invoker | Where you call a tool |
| Approvals | Pending gated actions waiting on a human |
| Contributions | Execution-intelligence feed — one event per successful call |
| Audit | Immutable log: actor, action, result, workspace |

Every panel polls `/api/mcp/*`. If they are all empty you are offline from the
backend — see [§8](#8-troubleshooting).

**The panels populate themselves on first load.** When you first hit
`/api/mcp/health`, the backend seeds demo activity (7 tools across all 7
connectors, plus one pending approval) **into your own workspace**. This is what
`MCP_SEED_DEMO_ACTIVITY=true` does. It is dev-only and forbidden in production.

---

## 4. Walkthrough A — a read tool (no credentials)

Proves: catalogue → invoke → audit → contribution.

1. In the catalogue, pick **`github` → `list_repositories`**.
2. Its schema (`input_schema`) takes one optional string, `org`. Leave it empty.
3. Invoke it.
4. Expect `ok: true` immediately — no gate, because it is read-only.

**Confirm:**
- A new row in the **Audit** table: `action: list_repositories`,
  `result: success`, `workspaceId: user-<your id>`.
- A new event at the top of **Contributions**.

Then try **`web3` → `get_balance`** with
`{"address": "0x1234567890abcdef1234567890abcdef12345678"}` — same shape, and
proves a second connector through the same path.

---

## 5. Walkthrough B — a destructive tool (the approval gate)

Proves: the human-in-the-loop gate, and that approvals are single-use.

1. Pick **`github` → `create_pull_request`** (it carries the gate chip).
2. Fill the four required fields:
   ```json
   { "repo": "acme/app", "head": "feat/login", "base": "main", "title": "Add login flow" }
   ```
   `repo`, `head`, `base`, `title` are required; `body` is optional.
3. Invoke.

**Expect `ok: false` with `error.code: "pending_approval"`** and a returned
`approvalRequestId`. Nothing was executed — this is the gate stopping it.

4. Open the **Approvals** panel. Your request is listed, pending, with its TTL
   (15 minutes by default, from `MCP_APPROVAL_TTL_MS`).
5. Approve it. If the UI offers it, use **Approve & re-run**; otherwise copy the
   id.
6. Re-invoke `create_pull_request` with the **same params plus**
   `"approvalRequestId": "<the id>"`.

**Expect `ok: true`** and a `success` audit row.

7. **Re-invoke a third time with that same id.** Expect `ok: false` —
   `expired`, `used`, or `action_mismatch`. Approvals are single-use, bound to
   one tool, and bound to your workspace. This is the most important thing on
   this page to verify.

**Why approval can refuse:**

| Reason | Meaning |
|---|---|
| `not_found` | Wrong id, or the process restarted (see §8) |
| `expired` | Past the TTL — start over |
| `used` | Already consumed. Single-use is deliberate |
| `workspace_mismatch` | The request belongs to another workspace |
| `action_mismatch` | The id was minted for a different tool |
| `insufficient_role` | Approver is below `admin`/`owner` |
| `human_required` | An agent actor cannot approve — only a human can |

---

## 6. Walkthrough C — connect a credential

Proves: the scoped secret vault, and that credentials are operator-only and
write-only.

A connector needs a stored credential only when it runs its **real** API. In the
default fake mode nothing is needed, which is why §4 and §5 work with an empty
vault. This walkthrough is about the plumbing, not about reaching GitHub.

1. Open the **Connections** panel. Seven rows, one per connector:

   | Column | Meaning |
   |---|---|
   | `mode` | `fake` = deterministic in-process API; `real` = live provider |
   | `connected` / `source` | `vault` = stored, `env` = an env var will seed it, `none` = nothing |
   | `expiresAt` | a date, or *never expires* |
   | `optional` | the tools work with no credential at all (`web3`, `ai`) |

2. Connect one. Pick **`web3`** and paste any Sepolia RPC URL, e.g.
   `https://sepolia.example/v3/KEY`. Its row flips to `connected: true`,
   `source: vault`.

3. **The value never comes back.** Reload the page — the panel shows *that* a
   credential is stored, never the credential. There is deliberately no route
   that reads one out; the connectors resolve it server-side at invoke time. A
   stolen browser session cannot exfiltrate a provider token through this API.

4. Disconnect it. The row returns to `connected: false`.

5. **What you should NOT expect:** connecting a credential does not switch the
   connector to the live provider. `web3` still reads `mode: fake` until the
   backend is started with `WEB3_CONNECTOR_MODE=real`. A credential with
   `mode: fake` is stored but unused.

**In dev you will usually see `github`, `notion`, and `figma` already
connected.** That is the fake plugins seeding a throwaway dev token at startup so
the lifecycle reaches `ready` (`plugins/github/index.ts:52`). It is not a real
credential and the rows still say `mode: fake`.

**Who may do this.** `GET /connections` is readable by any signed-in user.
Connect and disconnect require a **human admin or owner** — a credential here is
process-wide, so rotating it changes what every invocation uses, for every
tenant. Agents are always refused. Expect `403` from anything less than an owner.

**Disconnect and env fallback.** If a connector's env var is set
(`MCP_GITHUB_TOKEN`, `NOTION_TOKEN`, …), the plugin re-seeds the vault from it at
startup. Disconnect therefore reports `envFallback: true` — the credential is
gone now but returns on the next restart. To remove it for good, unset the env
var and restart.

---

## 7. Reading the API by hand

For when the UI and the API disagree. Get a token from your browser's
**sessionStorage** (`techit_access_token`) and:

```bash
TOKEN=<paste>

curl -s localhost:3000/api/mcp/health      -H "Authorization: Bearer $TOKEN"
curl -s localhost:3000/api/mcp/tools       -H "Authorization: Bearer $TOKEN" | jq 'length'   # 34
curl -s localhost:3000/api/mcp/audit       -H "Authorization: Bearer $TOKEN" | jq 'length'
curl -s localhost:3000/api/mcp/contributions -H "Authorization: Bearer $TOKEN" | jq 'length'
curl -s localhost:3000/api/mcp/approvals   -H "Authorization: Bearer $TOKEN" | jq 'length'

# connections — status only, never the secret
curl -s localhost:3000/api/mcp/connections -H "Authorization: Bearer $TOKEN" | jq

# invoke
curl -s localhost:3000/api/mcp/invoke -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"plugin":"github","tool":"list_repositories","params":{}}' | jq

# store / remove a connector credential (owner or admin only)
curl -s -X POST localhost:3000/api/mcp/connections/web3 -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"credential":"https://sepolia.example/v3/KEY"}' | jq
curl -s -X DELETE localhost:3000/api/mcp/connections/web3 \
  -H "Authorization: Bearer $TOKEN" | jq
```

`/health` returns the workspace **and** the actor the server actually resolved:

```json
{ "ok": true,
  "workspaceId": "user-b813f4fb-...",
  "actor": { "id": "b813f4fb-...", "kind": "human", "role": "owner" } }
```

**Your role is decided by the server**, from your profile row — not by anything
the browser sends. If a request body carries an `actor`, it is ignored.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/plugins` redirects home | Role is not `founder`/`organisation` | Expected — the guard. Use an owner account |
| All panels empty, "offline" banner | Backend not reachable on 3000 | Start Terminal 1; check `VITE_TECHIT_API` |
| **Every** `/api/mcp/*` returns **404** | `MCP_ENABLED` not `true` | Set it in `BACKEND/backend/.env` and restart |
| `/api/mcp/*` returns **401** | No profile row for the JWT subject | Sign in through the app first — `resolveActor` reads `profiles`, not the token alone |
| Feeds empty but `/tools` works | `MCP_SEED_DEMO_ACTIVITY` unset, and you have not invoked anything | Set it, restart, reload `/plugins`; or just invoke a tool |
| Feeds empty, flag **is** set | Your workspace already had activity, so the seed was skipped | Invoke a tool — you will see your own row |
| `invalid_input` | A `required` field is missing | Validation checks object shape + required keys **only** — no type or enum checking — so wrong *types* pass here and fail deeper |
| `permission_denied` | RBAC, workspace, or agent allow-list | The tool is above your role, or an agent's `toolsAllowed` excludes it |
| `pending_approval` | Correct behaviour for the 9 gated tools | Approve, then re-invoke with `approvalRequestId` (§5) |
| Approval vanished after a restart | File mode keeps approvals in memory only | Expected — re-invoke to mint a new request |
| `no stored OAuth token` | A connector is in `real` mode with nothing connected | Unset `<NAME>_CONNECTOR_MODE`, or connect a credential (§6) |
| Connections: **403** on connect/disconnect | Role is below `admin`/`owner`, or the actor is an agent | Expected — credentials are operator-only (§6) |
| Connections: `credential_required` | The credential field was empty or whitespace | Paste a value |
| Connections: `rpc_url_invalid` | The `web3` credential is not a parseable URL | Paste a full `https://…` URL |
| Connected, but the live provider is still not called | `mode` is still `fake` | A credential alone does not flip the mode — set `<NAME>_CONNECTOR_MODE=real` too (§6) |
| Disconnect says `envFallback: true` | An env var re-seeds this credential at startup | Unset the env var and restart (§6) |
| Backend won't boot | `NODE_ENV` is `production`/`staging` | Dev must not be production — the prod contract demands postgres + real credentials for all 7 connectors |

---

## 9. What dev does and does not prove

**Works locally with zero credentials:**
- All 7 connectors, all 34 tools, via each plugin's `Fake*Api`.
- The full authorisation path: platform JWT → RBAC → workspace → agent allow-list.
- The full approval lifecycle, including single-use enforcement.
- Audit and contribution feeds.
- The connect/disconnect plumbing: store, report status, remove, and the
  operator-only rule (§6). What *uses* the credential does not run in fake mode.

**Not proven in dev:**
- **Real provider calls.** Fakes return deterministic data. Real mode needs
  `<NAME>_CONNECTOR_MODE=real` **and** a stored credential or the tool throws
  `no stored OAuth token`. Connecting a credential through §6 does not by itself
  reach a provider — check the row still says `mode: fake` if it does not.
- **Credential durability.** `MCP_STORE=file` uses an in-memory vault, so
  anything connected is gone after a restart. Durable credentials need
  `MCP_STORE=postgres` + `MCP_SECRET_KEY`.
- **Per-tenant credential isolation.** Credentials are stored per *plugin*, not
  per workspace — the connectors are process-wide singletons registered once at
  boot, so a per-workspace credential could not be routed to the right connector
  anyway. This is why the connect routes are owner/admin-only. Threading the
  vault handle through `MCPClient.invoke` is the prerequisite for multi-tenant
  credentials, and is not done.
- **Approval durability.** Same reason as credentials — pending approvals are in
  memory.
- **Production readiness.** The production contract
  (`validateProductionConfig`) still fails closed: it requires
  `MCP_STORE=postgres`, forbids stub connectors and demo seeding, and requires
  `<NAME>_CONNECTOR_MODE=real` plus per-connector tokens. Booting dev proves none
  of that.

**GitHub OAuth scope note.** Both the connect surface and the trust surface now
request one shared scope set (`repo read:user user:email`, in
`src/config/github.js`) against a single callback. The *granted* scope is
recorded on the connection and surfaced by `GET /api/github/status` as `scopes`,
`repoAccess`, and `repoEnrichmentSkipped`, so a partial grant is visible instead
of silently yielding `repos = []` and zero recorded skills.

That is the platform's own GitHub OAuth (`/api/github/*`), which is **separate**
from the MCP connector's credential in §6. The MCP side takes a token you
supply; it does not run an OAuth dance. Wiring the platform's existing GitHub
OAuth result into the MCP vault is the natural next step and is not done.

---

## 10. Test checklist

- [ ] Both apps up: 3000 and 5173
- [ ] `/plugins` loads as a founder; redirects home as any other role
- [ ] Catalogue shows **34** tools / **7** connectors, gate chip on exactly **9**
- [ ] Feeds are non-empty on first load
- [ ] `github.list_repositories` → `ok: true`, new audit row + contribution event
- [ ] `create_pull_request` → `pending_approval` + an id
- [ ] Approve → re-invoke with the id → `ok: true`
- [ ] Re-invoke with the same id → refused (single-use)
- [ ] `/api/mcp/health` shows your real workspace and role
- [ ] `curl /tools | jq length` → 34
- [ ] Connections panel lists all 7 connectors with a `mode`
- [ ] Connect `web3` → row flips to `connected`, value never rendered back
- [ ] Disconnect `web3` → row returns to `connected: false`
- [ ] Connect/disconnect as a non-owner → `403`

---

## 11. Known dependency issues (`new-frontend/frontend`) — resolved

Three pre-existing defects in `package.json`, none from the MCP work. All three
were found and fixed on 2026-09-26.

**1. Duplicate dependency keys.** Every dependency was listed twice, and JSON
duplicate keys mean the *second* occurrence silently wins. That selected
`recharts@3.10.1` (code written for v2) and `typescript@7.0.2` (vs the intended
`~5.9.3`). Symptoms: 10 `tsc` errors across `chart.tsx`, `Earnings.tsx`,
`AllocationEngine.tsx` (all recharts v3 type errors), `npx eslint` refusing to
run with "typescript-eslint does not support TS 7.0", and vite printing nine
`duplicate-object-key` warnings on every start. Removing the second block
restored recharts 2.15.4 and TypeScript 5.9.3 → typecheck **0 errors**, eslint
clean, vite silent.

**2. Mismatched react-router versions.** The de-duplication left
`react-router-dom@7.18.3` against a top-level `react-router@7.18.2`. Because
`react-router-dom@7.18.3` requires exactly `react-router@7.18.3`, npm installed a
**second, nested copy**. Two module instances means two React contexts, so
`<Router>` wrote to one while `useLocation()` read the other and threw:

```
useLocation() may be used only in the context of a <Router> component
  at RouteMemory (App.tsx:342)
```

The result was a **completely black page** — an empty DOM, no error boundary.
Aligning `react-router-dom` to `7.18.2` dedupes to a single copy. If you ever
bump these, **bump both together**; `react-router` and `react-router-dom` must
never drift. Verify with:

```bash
find node_modules -path "*react-router/package.json" | wc -l   # must be 1
```

**3. `vitest@5` incompatible with `vite@5`.** `vitest@5` requires
`vite@^6 || ^7 || ^8`, but the project pins `vite@^5.4.21`, so `npx vitest run`
died instantly with `ERR_PACKAGE_PATH_NOT_EXPORTED` on `vite/module-runner` (a
subpath that does not exist before vite 6) — leaving all 54 frontend test files
unrunnable. Resolved by taking `vitest` to `^3.2.7`, which supports vite 5.
`vite` was deliberately left alone: it is load-bearing (it builds the app and
runs the dev server) and was the one dependency that had *not* been duplicated,
so it was clearly the intended pin. Vitest is test-only.

Current state: `npx tsc -b --noEmit` → 0 errors; `npx vitest run` → **54 files,
187 tests, all passing**; `npm install` needs no flags.

