ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_role TEXT NOT NULL DEFAULT 'community';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS audience TEXT[] NOT NULL DEFAULT '{all}';
CREATE INDEX IF NOT EXISTS idx_posts_author_role ON posts (author_role);
