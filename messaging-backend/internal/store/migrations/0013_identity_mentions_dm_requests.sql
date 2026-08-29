ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscriber BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credibility_score INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (lower(username)) WHERE username IS NOT NULL AND username <> '';
CREATE INDEX IF NOT EXISTS idx_users_display_name_lower ON users (lower(display_name));

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES users(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS request_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_request_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_request_status_check CHECK (request_status IN ('active','pending','declined'));

ALTER TABLE messages ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;
