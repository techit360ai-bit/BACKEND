-- 020_trust_identity_screening.sql
-- WS8 founder identity / KYC + sanctions/PEP screening tables.
-- Metadata only: decisions, opaque provider references, and hashes. No
-- documents and no raw sanctions names are stored. Screening rows are
-- append-only (insert-only; a re-screen adds a new row).

CREATE TABLE IF NOT EXISTS trust_identity_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,               -- kyc | registry
  status TEXT NOT NULL,             -- verified | failed | pending
  provider_reference TEXT,
  subject TEXT,
  country TEXT,
  result_hash TEXT,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_identity_verifications_user
  ON trust_identity_verifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_identity_verifications_provider
  ON trust_identity_verifications(user_id, provider);

CREATE TABLE IF NOT EXISTS trust_screening_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  subject_hash TEXT,                -- hash of the screened name, never the name
  status TEXT NOT NULL,             -- clear | potential_match | match
  match_count INTEGER NOT NULL DEFAULT 0,
  country TEXT,
  result_hash TEXT,
  screened_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_screening_results_user
  ON trust_screening_results(user_id, provider, screened_at DESC);
