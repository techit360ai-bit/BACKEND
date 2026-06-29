CREATE TABLE IF NOT EXISTS app_collections (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_at TEXT NOT NULL
);
