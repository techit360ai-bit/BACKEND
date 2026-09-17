# Deterministic Intelligence Runbook

## Runtime flags

- `DETERMINISTIC_INTELLIGENCE_ENABLED=true`
- `AI_NARRATIVE_ENRICHMENT_ENABLED=false` by default
- `AI_ROUTER_REQUIRED_FOR_TASKS=false`
- `EMBEDDING_REFRESH_MODE=deterministic|local|provider`
- AI Router: `AI_ROUTER_MODE=deterministic|hybrid|llm`

`deterministic` requires no LLM provider credentials. `hybrid` keeps provider enrichment optional. `llm` preserves fail-closed provider requirements for language tasks.

## Rollout

1. Deploy Backend deterministic endpoints and keep AI narrative enrichment disabled.
2. Shadow score outputs with `recordParitySample`; investigate any drift above the configured tolerance.
3. Canary Discovery, Feed, Return Intelligence, Dashboard, and matching by role.
4. Enable narrative enrichment only for allowlisted tasks after cost and failure-rate review.
5. Use deterministic responses whenever AI Router is unavailable.

## Monitoring

Track deterministic latency, cache hits, queue age, parity drift, recommendation outcomes, AI enrichment rate, provider cost, circuit-breaker opens, and human overrides. A narrative failure is not a deterministic endpoint failure.

## Rollback

Disable the affected consumer flag or narrative enrichment. Do not roll back persisted user signals, recommendation feedback, activity state, or catch-up completion. AI output must never override eligibility, safety, permissions, scores, or workflow state.
