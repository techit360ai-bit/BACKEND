CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trust_user_roles (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', assurance TEXT NOT NULL DEFAULT 'CLAIMED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_trust_user_roles_user ON trust_user_roles(user_id, status);

CREATE TABLE IF NOT EXISTS trust_verification_profiles (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, assurance TEXT NOT NULL,
  status TEXT NOT NULL, trust_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  evidence_quality TEXT, verified_by TEXT, verified_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_trust_verification_expiry ON trust_verification_profiles(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS trust_verification_requests (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, claim_type TEXT NOT NULL,
  requested_capability TEXT, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_requests_queue ON trust_verification_requests(status, created_at);

CREATE TABLE IF NOT EXISTS trust_verification_evidence (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL,
  method TEXT NOT NULL, strength TEXT NOT NULL, status TEXT NOT NULL, source TEXT,
  object_key TEXT, content_type TEXT, size_bytes BIGINT, malware_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}', ai_advisory JSONB, submitted_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_evidence_request ON trust_verification_evidence(request_id, submitted_at);

CREATE TABLE IF NOT EXISTS trust_organizations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, website TEXT, country TEXT, type TEXT NOT NULL,
  status TEXT NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS trust_organization_domains (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS trust_organization_memberships (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL,
  status TEXT NOT NULL, verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS trust_risk_profiles (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, note TEXT,
  updated_by TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trust_capability_policies (
  capability TEXT PRIMARY KEY, policy JSONB NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trust_authorization_audit (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, capability TEXT NOT NULL, allowed BOOLEAN NOT NULL,
  code TEXT NOT NULL, active_role TEXT, assurance TEXT, risk_state TEXT, policy_version TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_auth_audit_capability ON trust_authorization_audit(capability, created_at DESC);

CREATE TABLE IF NOT EXISTS trust_verification_audit (
  id TEXT PRIMARY KEY, user_id TEXT, actor_id TEXT, action TEXT NOT NULL,
  previous_state TEXT, new_state TEXT, policy_version TEXT NOT NULL,
  signature TEXT, payload JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trust_capability_consumptions (
  id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL,
  capability TEXT NOT NULL, funding_source TEXT NOT NULL, credits NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL, response_status INTEGER, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trust_capability_analytics (
  id TEXT PRIMARY KEY, user_id TEXT, capability TEXT NOT NULL, event_type TEXT NOT NULL,
  role TEXT, assurance TEXT, code TEXT, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_capability_analytics ON trust_capability_analytics(capability, event_type, created_at DESC);
