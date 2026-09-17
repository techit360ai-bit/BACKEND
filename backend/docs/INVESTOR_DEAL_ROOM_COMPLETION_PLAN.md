# Investor Due Diligence + Deal Room Completion Plan

## Scope

This phase completes the investor-only Deal Room on top of the merged Phase 1
foundation. It extends the existing Investor Hub and Deal Room routes and keeps
the existing Mentorship Hub, startup analysis, storage, notifications, roles,
and authentication as the source of truth.

Wallet, subscriptions, pricing, credit settlement, and BillingGuard are
explicitly excluded. They will be implemented manually as a separate workstream.
This phase must not add billing gates or mutate billing state.

## Non-negotiable boundaries

- Every authorization, relationship check, NDA gate, state transition,
  visibility decision, freshness rule, aggregation, deadline rule, and audit
  write is deterministic backend code.
- The AI Router receives only backend-authorized, labelled evidence and may
  provide explanation, summarization, or narrative recommendations. It cannot
  authorize access, calculate canonical metrics, change deal state, or make an
  investment decision.
- Sensitive deal-room data is private by default and never enters public feed,
  search, ordinary notifications, or analytics exports.
- Verified, founder-reported, third-party-provided, and unavailable values are
  distinct fields in API responses.
- Existing CodebaseAnalysisEngine output is the only source for technical DD;
  raw source code is never accepted or persisted by this feature.

## Delivery phases

1. **Persistence and authorization hardening**: add normalized PostgreSQL and
   SQLite migrations for Deal Room entities, visibility indexes, append-only
   status/audit records, and institutional participant roles. Keep the JSON
   driver compatible for existing tests.
2. **Secure document vault**: implement deal-scoped folders, evidence requests,
   immutable versions, SHA-256 checksums, signed private access, expiration and
   revocation, access/download events, and existing ClamAV/storage validation.
3. **Questionnaire and verification**: add default/custom questionnaire
   templates, founder submissions, platform prefill labels, technical DD from
   existing analysis, aggregate-only revenue verification adapters, and
   tokenized anonymized references.
4. **Institutional workflow**: enforce owner/reviewer/IC/legal/finance/read-only
   team roles, private IC records, approval history, term-sheet share/comment/
   final lifecycle, and deterministic closing-readiness conditions.
5. **Investor Pack and operations**: generate a labelled summary pack, schedule
   expiry/reminder/staleness jobs through existing notification/task patterns,
   and expose only contextual Deal Room panels inside the current Investor
   screens. No sidebar expansion is required.
6. **Verification**: run unit, API, privacy, relationship isolation, migration,
   mobile build, and end-to-end tests. Document actual schema/route/task counts.

## Completion acceptance

- Investor-to-investor and founder-to-investor isolation passes.
- NDA, document, Q&A, IC, term-sheet, and closing gates are server enforced.
- Malware and file-signature validation run before a document becomes available.
- Technical DD is unavailable with a freshness warning when analysis is missing or
  stale.
- Revenue verification never stores raw processor/customer data and returns
  `null` when unverified.
- Reference identity is not present in investor-facing response data.
- Audit records are hash chained and application code exposes no update/delete
  operation.
- Existing Investor Hub, Mentorship Hub, roles, auth, and notifications regress
  neither in behavior nor route shape.
- No wallet, subscription, pricing, credit, or BillingGuard implementation is
  included.
