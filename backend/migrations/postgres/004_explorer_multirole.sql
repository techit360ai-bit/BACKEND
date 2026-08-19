CREATE TABLE IF NOT EXISTS techit_active_contexts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  role_assignment_id TEXT,
  organization_id TEXT,
  workspace_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE trust_user_roles ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trust_user_roles ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE trust_user_roles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE trust_user_roles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE trust_user_roles ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'claimed';
CREATE INDEX IF NOT EXISTS idx_techit_active_contexts_user ON techit_active_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_techit_active_contexts_workspace ON techit_active_contexts(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS techit_context_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  role_assignment_id TEXT,
  organization_id TEXT,
  workspace_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_techit_context_history_user ON techit_context_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS techit_role_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_techit_role_history_user ON techit_role_history(user_id, created_at DESC);
