ALTER TABLE posts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_fingerprint TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_content_fingerprint ON posts (author_id, content_fingerprint) WHERE content_fingerprint IS NOT NULL;
