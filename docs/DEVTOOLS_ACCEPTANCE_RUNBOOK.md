# DevTools Acceptance Runbook (WS-20)

**Purpose.** Prove, per role, that the browser surfaces (Network, Application storage,
cookies, IndexedDB, WebSocket frames, loaded sources) expose only what that role is
entitled to see. This is the runtime half of the exposure-hardening programme; the
static half is the test suite recorded in
`PLATFORM_SECURITY_IMPLEMENTATION_PLAN_2026-09-26.md`.

**Status:** ready, **not yet executed** — it needs a reachable staging environment
with frontend, Node backend, messaging service, ai-router and PostgreSQL/Redis running
together. Record results in the table at the end.

**Explicit non-goals.** Do **not** implement F12 blocking, right-click blocking,
DevTools detection, or app freezing. Information minimisation is the fix; hiding
DevTools is not.

## Setup

1. Use a clean browser profile per role (no shared cache, no shared cookies).
2. Open DevTools → Network, enable "Preserve log", and disable cache.
3. Open Application (Storage, Cookies, IndexedDB, Service Workers, Cache Storage).
4. Open Sources and note the loaded bundles/source maps.
5. Have the messaging WebSocket frames visible (Network → WS → Messages).
6. Sign in as the role under test; note the sign-in timestamp.

## Per-role walkthrough

For **Explorer, Founder, Collaborator, Investor, Organization, Admin**:

| Step | Action | What to verify |
|---|---|---|
| 1 | Sign in, load the dashboard | No access token or refresh token in `localStorage`/`sessionStorage`; only the HttpOnly `techit_access` cookie and the readable `techit_csrf` cookie are present. |
| 2 | Network: open every first-party request | Responses carry no `set-cookie` with a raw token body; no response field named `token`, `provider`, `provider_cost_usd`, `system_prompt`, or internal cost/route data. |
| 3 | Application → IndexedDB | Snapshots are scoped to *this* account id; sign out/in as another account and confirm the previous account's snapshots are gone. |
| 4 | Feed: create a post | 201/200; the new post appears without a page reload; the WebSocket shows no token in the URL. |
| 5 | Direct messages: send to another member | Delivery + read receipt arrive; a non-member cannot open the conversation by editing the URL/`convId`. |
| 6 | Offer a known-forbidden action for the role | The UI and the API both refuse (4xx), with no data in the response. |
| 7 | Sources | No server secret, key, or `.env` value is present in any bundle or source map. |
| 8 | Sign out | Cookies cleared; cached private snapshots purged; back button does not restore authed data. |

### Negative checks (must fail closed)

- Replay a request with the token removed → `401`.
- Change a path id (`convId`, `workspaceId`, `projectId`) to another tenant's → `403`/`404`, no data.
- Send a body with `plan: "enterprise"`, `is_admin: true`, `credits: 999999` → no entitlement change.
- Reuse a stale/rotated token → `401`.
- Replay an idempotency key → single effect.

## Results

| Role | Date | Operator | Network | Storage/IndexedDB | Cookies | WS frames | Sources | Result | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Explorer | | | | | | | | pending | |
| Founder | | | | | | | | pending | |
| Collaborator | | | | | | | | pending | |
| Investor | | | | | | | | pending | |
| Organization | | | | | | | | pending | |
| Admin | | | | | | | | pending | |

**Blocked by:** a reachable staging environment. Without it every row stays `pending`,
and `RELEASE_CANDIDATE_SIGNOFF.md` must not be approved.
