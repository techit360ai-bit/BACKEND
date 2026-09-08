CREATE TABLE IF NOT EXISTS core_projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  organization_id TEXT,
  title TEXT,
  stage TEXT,
  visibility TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS core_workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  project_id TEXT,
  organization_id TEXT,
  name TEXT,
  status TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS core_workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT,
  status TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(workspace_id, user_id)
);
CREATE TABLE IF NOT EXISTS core_workspace_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  project_id TEXT,
  assignee_id TEXT,
  status TEXT,
  title TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_core_projects_owner ON core_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_core_projects_org ON core_projects(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_core_workspaces_project ON core_workspaces(project_id);
CREATE INDEX IF NOT EXISTS idx_core_members_user ON core_workspace_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_core_tasks_workspace_status ON core_workspace_tasks(workspace_id, status);
