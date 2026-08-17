CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS discovery_profiles (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  interests JSONB NOT NULL DEFAULT '{}',
  skills JSONB NOT NULL DEFAULT '{}',
  intent JSONB NOT NULL DEFAULT '{}',
  recent_interests JSONB NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_entities (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  creator_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  embedding vector(128),
  trust_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  gsis_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_discovery_entities_type_updated ON discovery_entities(entity_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_entities_tags ON discovery_entities USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_discovery_entities_embedding ON discovery_entities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE TABLE IF NOT EXISTS discovery_recommendations (
  recommendation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  rank INTEGER NOT NULL,
  reason_type TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}',
  config_version TEXT,
  generated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_discovery_recommendations_user_surface ON discovery_recommendations(user_id, surface, score DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_recommendations_expiry ON discovery_recommendations(expires_at);

CREATE TABLE IF NOT EXISTS discovery_events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT,
  actor_id TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  importance TEXT NOT NULL DEFAULT 'MEDIUM',
  surface TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discovery_events_user_time ON discovery_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_events_entity_time ON discovery_events(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS discovery_feedback (
  feedback_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  recommendation_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  feedback_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  undone_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS discovery_exposures (
  exposure_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  surface TEXT,
  exposure_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discovery_exposures_user_entity ON discovery_exposures(user_id, entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS discovery_activity_state (
  user_id TEXT PRIMARY KEY,
  last_meaningful_at TIMESTAMPTZ,
  return_anchor_at TIMESTAMPTZ,
  return_detected_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovery_catchup_state (
  user_id TEXT NOT NULL,
  anchor TIMESTAMPTZ NOT NULL,
  seen_ids JSONB NOT NULL DEFAULT '[]',
  dismissed_ids JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, anchor)
);

CREATE TABLE IF NOT EXISTS discovery_config (
  config_id TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
