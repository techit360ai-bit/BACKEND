ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_reason TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_posts_moderation_queue ON posts (moderation_status, abuse_score DESC, created_at DESC);
CREATE TABLE IF NOT EXISTS feed_discovery_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id), location TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}', industries TEXT[] NOT NULL DEFAULT '{}', interests TEXT[] NOT NULL DEFAULT '{}',
  credibility DOUBLE PRECISION NOT NULL DEFAULT 0, startup_quality DOUBLE PRECISION NOT NULL DEFAULT 0,
  contribution_score DOUBLE PRECISION NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
