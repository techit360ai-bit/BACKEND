CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_identifier TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  device_identifier TEXT,
  device_name TEXT,
  platform TEXT,
  browser TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_refreshed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  remember_me BOOLEAN NOT NULL DEFAULT true,
  rotation_counter INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active_at DESC);

CREATE TABLE IF NOT EXISTS auth_security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  session_identifier TEXT,
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_security_events_user_time ON auth_security_events(user_id, created_at DESC);
