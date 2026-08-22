INSERT INTO app_collections (name, value, updated_at)
VALUES
  ('investorQuestionnaireTemplates', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('investorQuestionnaireSubmissions', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('revenueVerifications', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('referenceRequests', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('comparableTransactions', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('icApprovalHistory', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('investorPacks', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('dealClosingItems', '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(name) DO NOTHING;
