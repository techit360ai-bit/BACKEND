ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'visible';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS abuse_score INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS feed_creator_controls (
  user_id UUID NOT NULL REFERENCES users(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  control TEXT NOT NULL CHECK (control IN ('mute', 'block')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creator_id, control),
  CHECK (user_id <> creator_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_creator_controls_user
  ON feed_creator_controls (user_id, control);
