# ADR — MCP Connector, Credential, Trust & Verification Decisions

**Date:** 2026-10-04
**Status:** Accepted (implemented on `feat/mcp-workspace-credentials`)
**Supersedes:** the "single-tenant / process-wide credential" model shipped in `feat/plugins-dashboard`.

> Normative language: **MUST** / **MUST NOT** describe enforced behaviour, not aspirations.

---

## ADR-1 — Credentials are **workspace-scoped** (not platform-wide, not user-scoped)

**Decision.** A credential belongs to a **workspace**, not to a user and not to the process.

```
User
  ↓
Workspace
  ↓
Credential
  ↓
MCP / Connector
  ↓
External Provider
```

**Model:** `workspace_id`, `provider`, `credential_id`, `scopes`, `created_by`, `expires_at`, `status`.

**Enforcement chain (every request):**

```
request → authenticated user → workspace membership → credential belongs to workspace
        → requested scope authorized → MCP action authorized → audit
```

**Consequences.**
- A founder in Workspace A and Workspace B: A's GitHub credential MUST NOT be usable against B.
- Agents authenticate as the **acting workspace**; there is no cross-workspace credential resolution.
- The connection API (`/api/mcp/connections*`) is scoped to the caller's workspace.

---

## ADR-2 — ONE canonical **Workspace Credential Vault**

**Decision.** The Workspace Credential Vault is the single source of truth for connector secrets.

```
            ┌──────────────┐
            │ Workspace    │
            │ Credential   │
            │ Vault        │
            └──────┬───────┘
                   │
     ┌─────────────┼─────────────┐
     ↓             ↓             ↓
   GitHub         X/LinkedIn    Other MCP
```

**Connection ≠ Credential.** A *connection* says which external system is reachable; the *vault* stores the
secret that authorizes access. They are separate records.

**Migration rule.** Legacy locations MAY be read **only during migration** (bootstrap import). Permanent
dual-read MUST NOT be designed in. One store of record.

**Security invariant.** Secrets MUST NEVER reach: clients, HTTP responses, logs, prompts, or AI model context.
Only `presence`, `source`, `scopes`, and `expiresAt` are ever observable.

---

## ADR-3 — `MCP_*_TOKEN` is **legacy / bootstrap-only** (KEEP → DEPRECATE → REMOVE)

**Decision.** Environment connector tokens are a **legacy/bootstrap credential mechanism — not production
architecture.**

```
Current
MCP_*_TOKEN
     ↓  bootstrap/import
Workspace Credential Vault
     ↓  MCP reads vault
environment token disabled
```

**Hard rule.** Agents and user-facing requests MUST NOT dynamically fall back to `MCP_*_TOKEN`. If no
workspace credential is present, the call fails closed with `credential_missing` — it does not silently use env.

**Lifecycle.**
- `KEEP TEMPORARILY` — import is available **only** behind explicit bootstrap config
  (`MCP_CREDENTIAL_BOOTSTRAP=import`).
- Every import emits telemetry (`credential_bootstrap_used`) and is marked deprecated.
- `DEPRECATE` — status surfaces `deprecated: true`; docs label it legacy.
- `REMOVE` — removal milestone: **2026-12-31** (`ENV_CREDENTIAL_REMOVAL_MILESTONE`). After this, env bootstrap
  is deleted and only the vault is consulted.

---

## ADR-4 — The **Trust Engine is canonical**

**Decision.** The Trust Engine owns canonical evidence, verification, and trust signals. No other system
(MCP, Workspace, Profiles, Matching, GSIS, or the Execution Reputation Graph) may compute its own trust.

```
                    ┌─────────────────────┐
                    │    TRUST ENGINE     │
                    │  canonical evidence │
                    │  verification       │
                    │  trust signals      │
                    └──────────┬──────────┘
                               │
       ┌───────────────┬───────┼───────────────┐
       ↓               ↓       ↓               ↓
    Profile         Matching  Workspace       GSIS
       ↓               ↓       ↓               ↓
                 Execution Reputation Graph
                (a downstream, contextual VIEW)
```

**Consequences.**
- The Execution Reputation Graph is **not** a second trust engine; it renders trust-engine output per role
  (Founder / Collaborator / Investor / Organization).
- Trust engine is `services/trustVerificationAuthority.js` (12 proof sources, trust score).
- The assurance model is retained **only** for investor and organization role review, where it does not alter
  security structure.

---

## ADR-5 — X / Twitter verification — **DEFERRED**

**Decision.** X is not a first-class verification source. It is **supplementary** and lowest in the evidence
hierarchy until real demand exists.

```
              TECHIT EXECUTION        ← strongest signal
                   ↑
      GitHub     LinkedIn   Website
                   │
              X / Twitter            ← supplementary
```

If ever enabled: weight ≤ 5, clone the LinkedIn flow. No M2 engineering effort is spent on it now.

---

## Consequences for the branch

| Decision | Effect on `feat/plugins-dashboard` |
|---|---|
| ADR-1 | Replaces the "process-wide, single-tenant" credential comment and the `requireOperator` platform-wide gate with workspace-scoped resolution. |
| ADR-2 | `connect/disconnect` write to the workspace lane of one vault; no third store. |
| ADR-3 | `authenticate()` no longer reads env at call time; env is imported once via bootstrap, with telemetry + deprecation. |
| ADR-4 | Trust engine keeps the canonical proof vocabulary; MCP does not add trust logic. |
| ADR-5 | No X code; document only. |
