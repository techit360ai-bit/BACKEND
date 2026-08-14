CREATE TABLE IF NOT EXISTS mcp_schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id text PRIMARY KEY,
  timestamp timestamptz NOT NULL,
  actor text NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  action text NOT NULL,
  source_tool text NOT NULL,
  resource text,
  result text NOT NULL CHECK (result IN ('success', 'failure', 'pending_approval', 'denied')),
  workspace_id text NOT NULL,
  detail jsonb
);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_workspace_time ON mcp_audit_log(workspace_id, timestamp);

CREATE TABLE IF NOT EXISTS mcp_approval_requests (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  requested_by text NOT NULL,
  action text NOT NULL,
  params jsonb NOT NULL,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'used')),
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_approvals_workspace_status
  ON mcp_approval_requests(workspace_id, status, created_at);

CREATE TABLE IF NOT EXISTS mcp_approval_decisions (
  id bigserial PRIMARY KEY,
  request_id text NOT NULL REFERENCES mcp_approval_requests(id),
  decided_by text NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'rejected', 'used')),
  decided_at timestamptz NOT NULL,
  comment text
);
CREATE INDEX IF NOT EXISTS idx_mcp_decisions_request ON mcp_approval_decisions(request_id, decided_at);

CREATE TABLE IF NOT EXISTS mcp_contributions (
  id text PRIMARY KEY,
  kind text NOT NULL,
  actor_id text NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  source_tool text NOT NULL,
  workspace_id text NOT NULL,
  project_id text,
  artifact_id text,
  weight double precision NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  timestamp timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_contributions_workspace_time
  ON mcp_contributions(workspace_id, timestamp);

CREATE TABLE IF NOT EXISTS mcp_secrets (
  namespace text NOT NULL,
  key_name text NOT NULL,
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL CHECK (octet_length(iv) = 12),
  auth_tag bytea NOT NULL CHECK (octet_length(auth_tag) = 16),
  key_id text NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(namespace, key_name)
);

CREATE OR REPLACE FUNCTION prevent_mcp_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'mcp_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mcp_audit_immutable ON mcp_audit_log;
CREATE TRIGGER mcp_audit_immutable
BEFORE UPDATE OR DELETE ON mcp_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_mcp_audit_mutation();

INSERT INTO mcp_schema_migrations(version) VALUES (1)
ON CONFLICT (version) DO NOTHING;
