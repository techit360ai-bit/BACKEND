# Capability Authorization Impact Report

## Existing contracts preserved

- Authentication remains `requireAuth` with persisted profile role authority.
- Investor data already exists in `investorWatchlists`, `dealFlowSnapshots`, `capitalPools`, `dealRooms`, `dataRooms`, and investor reputation collections.
- Organization data already exists in organization dashboards, organization-owned projects, marketplace, talent, programs, settings, integrations, and analytics collections.
- Wallet, credit ledger, subscriptions, usage reservations, and settlement already provide deterministic credit accounting.
- Discovery and intelligence already provide role-aware recommendation and trust signals.

## New authorization boundary

`requireRole` remains available for low-risk legacy routes. New sensitive routes use `requireCapability`, which evaluates the active role, assurance level, risk state, organization membership, account state, subscription entitlement, and available credits in one Backend policy engine.

The policy engine is authoritative. Frontend claims, JWT role claims, AI confidence, and public badges cannot grant access.

## Initial capability categories

- Discovery: public startup and organization browsing.
- Investor: personalized investor surfaces, sensitive startup intelligence, founder contact, indication submission, deal-room and institutional analytics.
- Organization: organization profile, recruiting, analytics, opportunity creation, and institutional analytics.
- Verification: role-specific verification requests and evidence submission.
- Administration: review queues, policy configuration, and audit history.

Capabilities requiring assurance, subscription, or credits are deliberately limited to sensitive actions. Existing users retain basic role access and are asked for verification only at the protected capability boundary.

## AI boundary

Backend performs role activation, evidence strength, assurance transitions, subscription/credit checks, risk restrictions, and final authorization deterministically. AI Router may later classify submitted evidence, extract claims, detect contradictions, or prioritize reviews. AI output is stored as advisory evidence and never changes an authorization decision directly.
