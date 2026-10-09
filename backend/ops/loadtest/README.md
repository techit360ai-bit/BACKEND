# Founder Trust load test (1M-user acceptance gate)

## Why this exists

The pre-WS0 request path loaded the *entire* platform database per request
(`postgresAuthority` middleware). The 1M-user goal is defined by a regression
gate that proves the request path no longer scales with total data.

## Acceptance gate

Run `founder-trust.k6.js` against a dataset of **1,000,000 seeded users** with a
**TARGET_VUS** derived from the approved DAU/concurrency target.

Pass criteria (pending sign-off — see Open Decisions):

- `p95` trust read latency `< 300 ms`, `p99 < 800 ms`.
- `http_req_failed` rate `< 0.1%`.
- Replica memory stays flat for the whole run (no per-request growth).
- Query instrumentation shows **zero** full-table reads of
  `platform_collection_records` in the request path.

## Open decisions (blocking the "1M certified" claim)

1. **Target DAU / peak concurrency.** VUs must be derived from this, not guessed.
2. **Replica count + autoscaling policy** used for the run.
3. **Read replicas available?** Needed to hit p95 at the target read mix.

Until these are recorded here, treat the numbers as unverified.

## How to run

```bash
k6 run \
  -e BASE_URL=https://staging.example.com/api \
  -e AUTH_TOKEN="$(cat /tmp/test-founder.jwt)" \
  -e TARGET_VUS=500 \
  ops/loadtest/founder-trust.k6.js
```

Seed tooling and the query-instrumentation assertion ship with WS11.
