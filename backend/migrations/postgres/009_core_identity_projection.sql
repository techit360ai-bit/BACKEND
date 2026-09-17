CREATE TABLE IF NOT EXISTS core_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS core_profiles (
  id TEXT PRIMARY KEY REFERENCES core_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  role TEXT NOT NULL,
  workspace_id TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_onboarded BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS core_user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  assurance TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, role)
);
CREATE TABLE IF NOT EXISTS core_active_contexts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES core_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  role_assignment_id TEXT,
  organization_id TEXT,
  workspace_id TEXT,
  resource_type TEXT,
  resource_id TEXT,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_core_profiles_role ON core_profiles(role);
CREATE INDEX IF NOT EXISTS idx_core_user_roles_user_status ON core_user_roles(user_id, status, active);
CREATE INDEX IF NOT EXISTS idx_core_contexts_workspace ON core_active_contexts(workspace_id) WHERE workspace_id IS NOT NULL;
