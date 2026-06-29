-- DM dedup: a stable key per 1:1 pair, enforced unique at the DB so concurrent
-- GetOrCreateDM calls cannot create two conversations for the same pair.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS dm_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_dm_key ON conversations (dm_key) WHERE dm_key IS NOT NULL;
