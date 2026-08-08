CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_events_user_type ON feed_events (user_id, event_type);
