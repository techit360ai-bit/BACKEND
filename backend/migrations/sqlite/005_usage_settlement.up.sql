INSERT INTO app_collections (name, value, updated_at)
VALUES ('usageReservations', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
