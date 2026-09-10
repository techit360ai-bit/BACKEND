-- Audited soft-delete and edit metadata. Content remains in place for legal hold/audit.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edit_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID;
CREATE TABLE IF NOT EXISTS message_mutation_audit (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id),
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  previous_hash TEXT,
  new_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edit_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS edit_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS deleted_by UUID;
CREATE TABLE IF NOT EXISTS feed_mutation_audit (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  previous_hash TEXT,
  new_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
