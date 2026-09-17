ALTER TABLE discovery_entities ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE discovery_entities ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE discovery_entities ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE discovery_entities ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE discovery_entities ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'PUBLIC';
CREATE INDEX IF NOT EXISTS idx_discovery_entities_scope ON discovery_entities(owner_id, organization_id, workspace_id, visibility, classification);
