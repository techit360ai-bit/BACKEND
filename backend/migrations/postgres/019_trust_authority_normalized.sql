-- 019_trust_authority_normalized.sql
-- Row-level trust authority tables. Complements 018_trust_proof_authority.sql
-- and lets the Trust Center run without the whole-database snapshot authority.
-- Privacy rule: metadata + aggregates + hashes only. No raw provider payloads,
-- tokens, documents, analytics events, or customer PII are stored here.

ALTER TABLE trust_verification_proofs
  ADD COLUMN IF NOT EXISTS attestation_level TEXT NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS correlation_group TEXT,
  ADD COLUMN IF NOT EXISTS half_life_days NUMERIC,
  ADD COLUMN IF NOT EXISTS metric_window TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT NOT NULL DEFAULT 'trust-v2',
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE trust_verified_skills
  ADD COLUMN IF NOT EXISTS policy_version TEXT NOT NULL DEFAULT 'trust-v2';

-- Anti-gaming lookups must be indexed: evidence reuse and provider-subject
-- reuse are cross-account checks, so they cannot rely on a per-user scan.
CREATE INDEX IF NOT EXISTS idx_trust_proofs_evidence
  ON trust_verification_proofs(evidence_hash);
CREATE INDEX IF NOT EXISTS idx_trust_proofs_subject
  ON trust_verification_proofs(source, provider_subject_id);

CREATE TABLE IF NOT EXISTS trust_verification_history (
  id TEXT PRIMARY KEY,
  verification_id TEXT,
  user_id TEXT NOT NULL,
  project_id TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  metadata_hash TEXT,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_trust_history_user
  ON trust_verification_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trust_verification_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  record_name TEXT NOT NULL,
  method TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_checked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_challenges_user
  ON trust_verification_challenges(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trust_challenges_token
  ON trust_verification_challenges(token_hash);

CREATE TABLE IF NOT EXISTS trust_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  trust_score NUMERIC NOT NULL DEFAULT 0,
  assurance TEXT,
  verification_status TEXT,
  confidence_score NUMERIC,
  breakdown JSONB NOT NULL DEFAULT '{}',
  signals JSONB NOT NULL DEFAULT '[]',
  proof_count INTEGER NOT NULL DEFAULT 0,
  verified_skill_count INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  policy_version TEXT NOT NULL DEFAULT 'trust-v2',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
-- NULL project_id means the user-level profile. Postgres treats NULLs as
-- distinct in a plain UNIQUE, so use partial indexes for both cases.
CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_profiles_user_global
  ON trust_profiles(user_id) WHERE project_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_profiles_user_project
  ON trust_profiles(user_id, project_id) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS trust_score_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  score NUMERIC NOT NULL DEFAULT 0,
  tier TEXT,
  breakdown JSONB NOT NULL DEFAULT '{}',
  policy_version TEXT NOT NULL DEFAULT 'trust-v2',
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_snapshots_user
  ON trust_score_snapshots(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trust_projection_outbox (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT,
  proof_id TEXT,
  score JSONB NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_trust_outbox_pending
  ON trust_projection_outbox(created_at) WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS trust_manual_reviews (
  id TEXT PRIMARY KEY,
  operation_kind TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  reason_code TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_trust_manual_reviews_op
  ON trust_manual_reviews(operation_kind, operation_id);

CREATE TABLE IF NOT EXISTS trust_anomaly_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_trust_anomalies_user
  ON trust_anomaly_events(user_id, created_at DESC);

-- Encrypted provider credentials for read-only verification sources.
-- encrypted_payload is ciphertext only; it is never projected or logged.
CREATE TABLE IF NOT EXISTS trust_connect_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_credentials_user_provider
  ON trust_connect_credentials(user_id, provider) WHERE revoked_at IS NULL;

-- WS3: revenue verification metadata. Non-secret columns only; the credential
-- itself stays in encrypted_payload.
ALTER TABLE trust_connect_credentials ADD COLUMN IF NOT EXISTS mode TEXT;
ALTER TABLE trust_connect_credentials ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE trust_connect_credentials ADD COLUMN IF NOT EXISTS account_domain TEXT;
ALTER TABLE trust_connect_credentials ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE trust_connect_credentials ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE trust_connect_credentials ADD COLUMN IF NOT EXISTS last_metrics JSONB;

-- Consistency-over-time snapshots (aggregates only, no PII).
CREATE TABLE IF NOT EXISTS trust_revenue_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credential_id TEXT,
  mrr NUMERIC(18,2),
  arr NUMERIC(18,2),
  paying_customers INTEGER,
  churn_rate NUMERIC(8,6),
  net_revenue_retention NUMERIC(8,6),
  gross_margin NUMERIC(8,6),
  currency TEXT,
  livemode BOOLEAN,
  as_of TIMESTAMPTZ,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_revenue_snapshots_user
  ON trust_revenue_snapshots(user_id, provider, created_at DESC);

-- WS4: product analytics verification (provider-observed engagement metrics).
CREATE TABLE IF NOT EXISTS trust_product_analytics_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credential_id TEXT,
  mau INTEGER,
  dau INTEGER,
  wau INTEGER,
  retention_d1 NUMERIC(8,6),
  retention_d7 NUMERIC(8,6),
  retention_d30 NUMERIC(8,6),
  activation_rate NUMERIC(8,6),
  as_of TIMESTAMPTZ,
  freshness_hours NUMERIC(10,2),
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_analytics_snapshots_user
  ON trust_product_analytics_snapshots(user_id, provider, created_at DESC);

-- WS5: shipping / deployment cadence verification (provider-observed delivery metrics).
CREATE TABLE IF NOT EXISTS trust_shipping_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credential_id TEXT,
  deploys_30d INTEGER,
  deploys_90d INTEGER,
  deploy_success_rate_30d NUMERIC(8,6),
  last_deploy_at TIMESTAMPTZ,
  merged_prs_30d INTEGER,
  merged_prs_90d INTEGER,
  releases_30d INTEGER,
  releases_90d INTEGER,
  uptime_30d NUMERIC(8,6),
  lead_time_hours NUMERIC(10,2),
  as_of TIMESTAMPTZ,
  freshness_hours NUMERIC(10,2),
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_shipping_snapshots_user
  ON trust_shipping_snapshots(user_id, provider, created_at DESC);

-- WS6: team / registry / HRIS verification (aggregates only, no employee PII).
CREATE TABLE IF NOT EXISTS trust_team_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  credential_id TEXT,
  entity_name TEXT,
  company_number TEXT,
  jurisdiction TEXT,
  headcount INTEGER,
  roles JSONB NOT NULL DEFAULT '[]',
  as_of TIMESTAMPTZ,
  freshness_hours NUMERIC(10,2),
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_team_snapshots_user
  ON trust_team_snapshots(user_id, kind, provider, created_at DESC);

-- Work-email OTP challenges. Only a hash of the code is stored, never the code.
CREATE TABLE IF NOT EXISTS trust_work_email_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  role TEXT,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_work_email_challenges_user
  ON trust_work_email_challenges(user_id, email_domain, created_at DESC);

-- Milestone evidence objects (WS7). Only scanned + hashed evidence may back a
-- milestone proof; the binary lives in object storage, never in Postgres.
CREATE TABLE IF NOT EXISTS trust_milestone_evidence (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  milestone_proof_id TEXT,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'upload_pending',
  malware_status TEXT NOT NULL DEFAULT 'pending',
  sha256 TEXT,
  scan JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_milestone_evidence_user
  ON trust_milestone_evidence(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_milestone_evidence_proof
  ON trust_milestone_evidence(milestone_proof_id);
