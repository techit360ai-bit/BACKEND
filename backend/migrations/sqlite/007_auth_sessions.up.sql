INSERT INTO app_collections (name, value, updated_at)
VALUES ('userSessions', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
INSERT INTO app_collections (name, value, updated_at)
VALUES ('authSecurityEvents', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
