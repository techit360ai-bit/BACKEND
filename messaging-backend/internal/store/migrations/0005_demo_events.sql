-- WS2 Demo Day: events + rosters. TEXT ids (accept dev-token user ids).
CREATE TABLE IF NOT EXISTS demo_events (
  id           TEXT PRIMARY KEY,
  host_id      TEXT NOT NULL,
  kind         TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  asset_url    TEXT,
  asset_type   TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_roster (
  event_id   TEXT NOT NULL REFERENCES demo_events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  room_role  TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_demo_events_host ON demo_events (host_id);
CREATE INDEX IF NOT EXISTS idx_demo_roster_user ON demo_roster (user_id);
