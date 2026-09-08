# Distribution Implementation Plan

## Wave 1: foundation (implemented)

- Reuse TechIT Moments as the first producer of shareable outcomes.
- Add distribution object, attribution, share/click, activation, and growth
  event contracts.
- Enforce visibility, source ownership, expiry, and single-account referral
  binding.
- Expose authenticated create/share/metrics APIs and public preview/click APIs.
- Pass signup referral IDs into the existing auth flow.

## Wave 2: product integrations

- Map existing validation, GSIS, achievement, readiness, and cohort outputs to
  distribution objects.
- Add optional share CTA metadata to existing result responses.
- Add invitation attribution without changing membership authority.

## Wave 3: measurement and operations

- Feed standardized growth events into the existing admin referral dashboard.
- Add feature/role/campaign dimensions and retention/conversion cohorts.
- Add fraud signals using existing rate limits, auth, and anomaly controls.

## Deferred until justified

QR generation, partner landing pages, automated success stories, AI-generated
growth recommendations, reward ledgers, and provider-specific social SDKs are
not required for the first valuable loop and should only be added when usage
evidence supports them.
