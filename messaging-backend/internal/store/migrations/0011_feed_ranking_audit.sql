CREATE TABLE IF NOT EXISTS feed_ranking_decisions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  post_id UUID NOT NULL REFERENCES posts(id),
  category TEXT NOT NULL,
  ranking_version TEXT NOT NULL,
  variant TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_ranking_decisions_user_time ON feed_ranking_decisions (user_id, created_at DESC);
