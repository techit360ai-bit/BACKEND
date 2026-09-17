INSERT INTO app_collections (name, value, updated_at)
VALUES
  ('supportCases', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportMessages', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportEvents', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportAssignments', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportFeedback', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportSlaPolicies', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportCategories', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportTeams', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportKnowledgeBase', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportTemplates', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportAuditLogs', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportLocks', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportAttachments', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportIncidents', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportIntelligenceSignals', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('supportSettings', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
