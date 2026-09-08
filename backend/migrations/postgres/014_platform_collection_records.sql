CREATE TABLE IF NOT EXISTS platform_collection_records (
  collection_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  owner_id TEXT,
  organization_id TEXT,
  workspace_id TEXT,
  project_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  version BIGINT NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (collection_name, record_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_records_owner
  ON platform_collection_records(collection_name, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_platform_records_org
  ON platform_collection_records(collection_name, organization_id, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_platform_records_workspace
  ON platform_collection_records(collection_name, workspace_id, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_platform_records_project
  ON platform_collection_records(collection_name, project_id, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_platform_records_payload_gin
  ON platform_collection_records USING GIN (payload);

CREATE TABLE IF NOT EXISTS platform_collection_events (
  id TEXT PRIMARY KEY,
  collection_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete', 'replay')),
  version BIGINT NOT NULL,
  idempotency_key TEXT UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_collection_events_record
  ON platform_collection_events(collection_name, record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_backfill_runs (
  id TEXT PRIMARY KEY,
  source_driver TEXT NOT NULL,
  status TEXT NOT NULL,
  collection_count INTEGER NOT NULL DEFAULT 0,
  record_count BIGINT NOT NULL DEFAULT 0,
  mismatch_count BIGINT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  report JSONB NOT NULL DEFAULT '{}'
);
