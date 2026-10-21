INSERT INTO app_collections (name, value, updated_at)
VALUES
  ('cofounderRequirements', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('cofounderRelationships', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('cofounderResponsibilities', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('cofounderObjectives', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('cofounderDecisions', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('cofounderActivity', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('cofounderAlignmentSnapshots', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('cofounderTeamSummaries', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
