INSERT INTO app_collections (name, value, updated_at)
VALUES
  ('recommendationProfiles', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('recommendationPreferences', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('recommendationConfigs', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('recommendations', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('recommendationReasons', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('recommendationEvents', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('recommendationFeedback', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('recommendationExposures', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('userInterests', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('userIntents', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('userSkills', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('entityRelationships', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('networkEdges', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('userActivityStates', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('catchUpStates', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
