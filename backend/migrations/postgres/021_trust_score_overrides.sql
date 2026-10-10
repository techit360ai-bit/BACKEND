-- 021_trust_score_overrides.sql
-- WS9 manual score overrides.
--
-- An override is an explicit, time-boxed, admin-applied adjustment to a
-- founder's trust score (optionally scoped to one source). It is surfaced in
-- the score breakdown as `manual_override` and is always audit-logged in
-- trust_manual_reviews. Reason code and expiry are mandatory: an override can
-- never be permanent or unexplained. Rows are never deleted, only revoked.

CREATE TABLE IF NOT EXISTS trust_score_overrides (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  source TEXT,
  delta NUMERIC NOT NULL,
  reason_code TEXT NOT NULL,
  note TEXT,
  admin_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_score_overrides_user
  ON trust_score_overrides(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_score_overrides_active
  ON trust_score_overrides(user_id, revoked_at, expires_at);
