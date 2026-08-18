# Deterministic Intelligence Migration Plan

## Objective

Run TechIT's high-volume intelligence without provider tokens whenever the result can be calculated from persisted data, validated rules, or deterministic scoring. Keep AI Router responsible for language reasoning, optional narratives, provider routing, safety, structured output validation, cost controls, and provider telemetry.

The target behavior is:

```json
{
  "score": 78,
  "status": "provisional_human_review_required",
  "evidence": {},
  "recommendations": [],
  "narrative": null,
  "ai_available": false
}
```

The Backend must return a useful deterministic result when AI Router is unavailable. AI enrichment must never be required for permissions, eligibility, safety, ranking state transitions, or database writes.

## Architectural Boundary

```text
Backend
  deterministic score kernels
  discovery and return intelligence
  feed ranking
  trust and eligibility filters
  training curriculum
  evidence gates
  caching and persistence
  optional narrative request
          |
          v
AI Router
  provider selection
  prompt construction
  safety checks
  structured output validation
  token/cost limits
  fallback routing
  provider telemetry
```

The Backend calls AI Router only through a narrow optional enrichment client. It must not duplicate provider SDKs, prompts, fallback chains, or token accounting.

## Current Ownership and Target Ownership

| Capability | Current source | Target | Token requirement |
| --- | --- | --- | --- |
| GSIS, EVI, EVI-I, UPS, investment, match, decay, PPS, TSS, WCRS, CIS, IIS, BSS, MRS, FRS | `ai-router/ai_router_core.py`, `gsis_v2.py`, `investor_evi.py` | Backend score-kernel module | None |
| Discovery ranking, diversity, cooldowns, feedback, Return Intelligence | `BACKEND/backend/src/services/discoveryService.js` | Keep and expand in Backend | None |
| Redis cache, PostgreSQL/pgvector projection, deterministic embeddings | `BACKEND/backend/src/services/discoveryInfrastructure.js` | Keep in Backend | None; paid embeddings optional background enhancement |
| Feed eligibility, moderation thresholds, abuse scores | `BACKEND/messaging-backend/internal/store/postgres` | Keep in messaging Backend | None |
| Trust badges and metadata-only normalization | `ai-router/trust_engine_lite.py`, `trust_integration_adapters.py` | Backend trust service | None, except external provider credentials for verification |
| Adaptive curriculum and time-to-MVP | `ai-router/training_module.py` | Backend training service | None |
| Impact, priority, deployment-readiness calculations | `ai-router/idea_solution_hub.py` | Backend solution service | None |
| Profile completeness and rule-based suggestions | `agent_orchestration.py` `AIProfileAgent` | Backend profile service | None |
| Momentum, daily plan, decay alerts | `TourGuideAgent` | Backend activity service | None |
| Anomaly thresholds and escalation state | `AdminMonitorAgent` | Backend/admin security service | None |
| Risk evidence gates and missing-field status | `RiskEvaluatorAgent` | Backend evidence service | None |
| Match eligibility and persisted-candidate sorting | `MatchingAgent` | Backend Discovery | None |
| Natural-language explanations and narratives | agent orchestration and prompt assets | AI Router optional enrichment | Yes when enabled |
| Market intelligence, strategy, feasibility narrative, PMF, research synthesis | AI Router agents | AI Router | Yes |
| Documents, pitch decks, business plans, scaffold generation | AI Router document/app agents | AI Router | Yes |

## Response Contract

Create a shared versioned response envelope for Backend deterministic services and optional AI enrichment:

```json
{
  "schema_version": "intelligence-v1",
  "result": {},
  "score": 78,
  "status": "sufficient|insufficient_evidence|provisional_human_review_required|blocked",
  "evidence": {
    "sources": [],
    "missing_fields": [],
    "freshness": {},
    "confidence": 0.72
  },
  "recommendations": [],
  "narrative": null,
  "ai_available": false,
  "ai_enrichment_requested": false,
  "policy_id": "...",
  "policy_version": "...",
  "generated_at": "..."
}
```

Rules:

1. Deterministic `result`, eligibility, safety, and score fields are authoritative.
2. `narrative` is nullable and never required for a successful deterministic response.
3. AI output may explain or summarize a result but may not change the score, eligibility, trust status, permissions, or workflow state.
4. Missing or stale evidence produces an explicit status; it must not produce a plausible fabricated score.
5. Every score includes policy metadata and evidence provenance.

## Implementation Phases

### Phase 0 - Baseline and Freeze

- Inventory all AI Router call sites using `_call_ai`, `call_provider_model`, and provider adapters.
- Record current response schemas, score formulas, policy IDs, and existing Backend consumers.
- Freeze formula changes during migration.
- Add contract tests for current deterministic outputs and evidence-gated statuses.
- Establish feature flags:
  - `DETERMINISTIC_INTELLIGENCE_ENABLED`
  - `AI_NARRATIVE_ENRICHMENT_ENABLED`
  - `AI_ROUTER_REQUIRED_FOR_TASKS`
  - `EMBEDDING_REFRESH_MODE` (`deterministic`, `provider`, `local`)

### Phase 1 - Extract Shared Score Kernels

Create a Backend module, for example `backend/src/services/intelligence/scoreKernels.js`, with pure functions and no network calls.

Move or port with golden-vector tests:

- GSIS v2 and component scores.
- EVI and EVI-I.
- UPS/unicorn heuristic score.
- Investment score.
- Match score.
- Decay and momentum.
- PPS, TSS, WCRS, CIS, IIS, BSS, MRS, FRS.
- Compliance and transparency.
- Impact, problem priority, and deployment readiness.

Use the existing validated policy document as the source of truth. Do not rewrite formulas during the move. Preserve numeric precision, missing-input behavior, evidence fields, human-review flags, and policy metadata.

Verification:

- Python and JavaScript golden vectors match within an agreed tolerance.
- Boundary tests cover missing, zero, maximum, stale, and invalid inputs.
- No score kernel imports HTTP clients, provider SDKs, or AI Router clients.

### Phase 2 - Backend Deterministic Services

Add service boundaries around the kernels:

- `intelligence/gsisService.js`
- `intelligence/investorSignalsService.js`
- `intelligence/matchingService.js`
- `intelligence/trustService.js`
- `intelligence/trainingService.js`
- `intelligence/evidenceService.js`
- `intelligence/profileQualityService.js`
- `intelligence/activityService.js`

The services must read persisted records, enforce permissions and moderation state, calculate scores, and write auditable outcomes. They must not call AI Router on the critical path.

Integrate these services with the existing:

- `discoveryService.js`
- `domainService.js`
- context/dashboard services
- messaging feed ranking
- PostgreSQL/pgvector projection
- Redis refresh queue and cache

### Phase 3 - Discovery, Feed, and Return Intelligence Cutover

Keep the current Backend Discovery implementation as the primary implementation.

Complete the cutover so the following are Backend-only:

- Candidate generation.
- Role-aware ranking, including Explorer/User cold start.
- Trust and safety filtering.
- Recommendation explanations based on deterministic reason templates.
- Diversity, cooldown, repetition, staleness, and negative-feedback penalties.
- Recommendation exposure and outcome tracking.
- Return summary and Catch-Up Mode.
- Search candidate reranking while preserving complete-results mode.

AI may optionally rewrite a reason into natural language after the deterministic recommendation has been persisted. If AI fails, the deterministic reason is returned unchanged.

### Phase 4 - Training, Profile, Trust, and Admin Cutover

Move high-frequency non-generative logic:

- Adaptive curriculum generation and time-to-MVP.
- Profile completeness and missing-evidence suggestions.
- Trust badge and metadata normalization.
- Admin anomaly thresholds, abuse scores, and escalation states.
- Tour Guide momentum and daily-plan rules.

Retain AI only for optional coaching, explanation, or incident summaries.

### Phase 5 - Optional AI Enrichment Gateway

Create one Backend client, such as `aiNarrativeClient.js`, with:

- Request timeout.
- Circuit breaker.
- Strict task allowlist.
- Maximum input/output token budgets.
- Cache key and TTL.
- Provider/cost metadata.
- Fail-open behavior for narratives only.
- No permission to mutate deterministic result fields.

Allowed enrichment examples:

- Explain a GSIS result.
- Summarize a recommendation set.
- Explain a risk evidence gap.
- Produce coaching language for a deterministic training plan.
- Summarize an admin anomaly for human review.

Disallowed AI authority:

- Approve a user, startup, investor, project, or organization.
- Override moderation, trust, blocks, permissions, or eligibility.
- Change a score or workflow status.
- Invent a candidate or evidence source.
- Trigger deployment, investment, or irreversible state changes.

### Phase 6 - Embedding and Semantic Matching Cost Control

Default to the existing deterministic embedding/fingerprint path for discovery infrastructure.

Use provider embeddings only when all conditions hold:

- Background job, never synchronous page rendering.
- Entity changed since the last embedding.
- Entity is eligible for indexing.
- Cache miss and within configured budget.
- Provider cost and model metadata are current.

Support a local embedding model as a later alternative. Store embedding model, version, timestamp, and source. Do not make semantic embeddings a safety or permission requirement.

### Phase 7 - Runtime Modes and Provider Decoupling

Change AI Router runtime requirements from unconditional production provider keys to explicit modes:

- `deterministic`: no LLM provider keys required; score and discovery APIs remain fully functional.
- `hybrid`: deterministic APIs are primary; AI narratives are optional when keys are available.
- `llm`: AI-required tasks fail clearly when provider credentials are missing.

Update `runtime_config.py`, deployment manifests, health checks, and runbooks accordingly. Provider credentials should be required only if the selected mode or enabled feature needs them.

### Phase 8 - Rollout, Measurement, and Removal

- Shadow-run Backend kernels against current AI Router deterministic outputs.
- Compare score drift, recommendation ordering, evidence statuses, and meaningful outcomes.
- Canary by endpoint and role, including Explorer, Founder, Collaborator, Investor, and Organization.
- Enable deterministic path for Feed, Discovery, Dashboard, Return Intelligence, and matching first.
- Monitor latency, cache hit rate, AI enrichment rate, token spend, score drift, false positives, false negatives, and human overrides.
- Keep an immediate feature-flag rollback to the previous service path.
- After one stable release window, remove duplicate deterministic logic from AI Router agents.
- Keep AI Router adapters for narrative and reasoning tasks.

## Agent Conversion Rules

For every agent currently calling `_call_ai`:

1. Extract deterministic preprocessing and decision logic into Backend.
2. Return the deterministic result first.
3. Make the AI call optional and asynchronous.
4. Attach narrative only if the request is enabled, within budget, and the result is already persisted.
5. Preserve `human_review_required` and `insufficient_evidence` statuses.
6. Add tests with no API keys and with AI Router unavailable.

Agents that remain AI-first include market intelligence, startup strategy, finance narrative, product feasibility narrative, founder interrogation, evidence research, PMF synthesis, geographic intelligence, business plans, pitch documents, technical architecture reasoning, grant writing, and app/scaffold generation.

## API and Event Changes

Add or extend Backend endpoints:

- `GET /api/intelligence/gsis/:projectId`
- `GET /api/intelligence/investor-signals/:projectId`
- `POST /api/intelligence/match/score`
- `GET /api/intelligence/profile/:userId`
- `GET /api/discovery/recommendations`
- `GET /api/discovery/return-summary`
- `GET /api/discovery/catch-up`

Emit events:

- `intelligence_score_generated`
- `intelligence_evidence_missing`
- `intelligence_narrative_requested`
- `intelligence_narrative_completed`
- `intelligence_narrative_failed`
- `intelligence_policy_changed`
- `intelligence_rollout_changed`

Do not emit provider calls for deterministic-only requests.

## Data and Migration Requirements

- Reuse existing user, startup, project, profile, trust, recommendation, and activity tables.
- Add versioned score snapshots only where auditability requires historical values.
- Store policy ID/version, evidence provenance, freshness, confidence, and calculation timestamp.
- Keep existing recommendation and Return Intelligence tables as the system of record.
- Backfill scores in bounded batches; do not recompute the entire universe synchronously.
- Use expand/contract migrations and a tested rollback/restore path.

## Test Matrix

Every migrated service must pass:

- Unit tests for formulas and boundaries.
- Contract tests against the response envelope.
- No-key tests with AI Router offline.
- Permission, block, moderation, and trust-filter tests.
- Role tests for Explorer, Founder, Collaborator, Investor, and Organization.
- Cold-start and insufficient-evidence tests.
- Cache and idempotency tests.
- PostgreSQL/pgvector and Redis integration tests.
- AI enrichment success, timeout, malformed output, and unavailable-provider tests.
- Golden-vector parity tests during the migration window.

## Acceptance Criteria

- Feed, Discovery, Dashboard, Return Intelligence, matching, trust filtering, profile quality, and curriculum APIs work with no LLM API keys.
- Deterministic endpoints do not invoke AI Router or provider adapters.
- AI narrative failure does not change deterministic output or make the request fail.
- No AI output can override eligibility, permissions, moderation, trust, or score fields.
- Provider token spend is observable by task, endpoint, model, and role.
- Background embeddings are cached and budget-limited.
- Existing AI-first workflows retain their current structured-output and safety gates.
- Rollback can restore the previous path using a feature flag and known-good release.

## Explicit Non-Goals

- Removing AI Router.
- Replacing language reasoning with fragile keyword rules.
- Moving external verification credentials into Backend score kernels.
- Making deterministic scores equivalent to calibrated probabilities.
- Treating a free hosted model as token-free or risk-free.

