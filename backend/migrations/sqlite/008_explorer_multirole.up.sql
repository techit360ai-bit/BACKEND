INSERT INTO app_collections (name, value, updated_at)
VALUES
  ('activeContexts', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('contextHistory', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('roleHistory', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
