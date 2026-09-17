CREATE TABLE IF NOT EXISTS trust_verification_proofs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  source TEXT NOT NULL,
  method TEXT NOT NULL,
  provider_subject_id TEXT,
  status TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  points NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  evidence_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_proofs_user_status ON trust_verification_proofs(user_id, status, expires_at);
CREATE TABLE IF NOT EXISTS trust_verified_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  skill TEXT NOT NULL,
  source TEXT NOT NULL,
  proof_id TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  evidence_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_verified_skill ON trust_verified_skills(user_id, project_id, skill, status);
