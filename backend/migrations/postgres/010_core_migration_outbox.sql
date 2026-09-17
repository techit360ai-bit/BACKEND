CREATE TABLE IF NOT EXISTS core_migration_outbox (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  last_error TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_core_migration_outbox_aggregate_version ON core_migration_outbox(domain, aggregate_type, aggregate_id, version, operation);
CREATE INDEX IF NOT EXISTS idx_core_migration_outbox_pending ON core_migration_outbox(status, created_at) WHERE status = 'pending';
