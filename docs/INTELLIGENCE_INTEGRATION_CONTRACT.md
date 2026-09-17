# Intelligence Integration Contract

Backend consumers should use `/api/intelligence/*` and `/api/discovery/*` for deterministic ranking, matching, trust, profile, evidence, training, activity, feed, search, and Return Intelligence. These endpoints return `intelligence-v1` envelopes and remain functional without provider credentials.

The live messaging service may publish relationship and collaboration events through `/api/discovery/events` or its existing event bridge. The Backend persists the normalized network edge and refreshes affected recommendations asynchronously; messaging delivery is not a prerequisite for ranking.

Dashboard and admin consumers should display deterministic `result`, `score`, `status`, and `evidence` first. `narrative` is optional presentation text and must never be used to authorize, moderate, rank, or transition state.
