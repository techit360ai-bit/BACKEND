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

## Seeding the dataset

`platform:db:seed-1m` writes synthetic founder profiles into
`platform_collection_records` in batched, idempotent inserts. It is a staging
tool: it previews with `--dry-run` and refuses to run without `SEED_CONFIRM=1`
(and refuses production unless `SEED_ALLOW_PRODUCTION=true`).

```bash
npm run platform:db:seed-1m                       # dry-run: print the plan
SEED_USER_COUNT=1000000 SEED_CONFIRM=1 npm run platform:db:seed-1m
SEED_USER_COUNT=1000000 SEED_CONFIRM=1 npm run platform:db:seed-1m --purge   # cleanup
```

## Asserting zero whole-DB reads

The request path must perform no whole-database reads. Each replica exposes a
per-process counter at `GET /internal/metrics/platform-authority`
(service-auth via `INTERNAL_METRICS_SECRET`, falling back to
`TRUST_INGEST_SECRET`). Snapshot each replica before the k6 run, then assert the
live counters against those baselines afterwards:

```bash
curl -fsS -H "x-techit-internal-secret: $INTERNAL_METRICS_SECRET" \
  https://replica-a/internal/metrics/platform-authority > before-a.json
npm run platform:authority:assert -- \
  --url https://replica-a --url https://replica-b \
  --baseline before-a.json --baseline before-b.json
```

Use repeated `--input <file>` instead of `--url` to check offline evidence.

Exit code `0` means the request path stayed at zero request-path reads over the
window; `1` prints the offending source(s). Without `--baseline` the assertion
checks the process-lifetime totals instead of the run window.
