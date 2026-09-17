INSERT INTO app_collections (name, value, updated_at)
VALUES
  ('organizationHealthSnapshots', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationRiskSignals', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationActions', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationActivityEvents', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationKpiDefinitions', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationKpiValues', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationAuditEvents', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationReportSchedules', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationPartners', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationCohorts', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationResources', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationRecommendations', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('organizationReports', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
