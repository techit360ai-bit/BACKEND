-- WS2 Demo Day: audience Q&A. TEXT ids (accept dev-token user ids).
CREATE TABLE IF NOT EXISTS demo_questions (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES demo_events(id) ON DELETE CASCADE,
  asker_id    TEXT NOT NULL,
  body        TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_question_votes (
  question_id TEXT NOT NULL REFERENCES demo_questions(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_demo_questions_event ON demo_questions (event_id, created_at);
