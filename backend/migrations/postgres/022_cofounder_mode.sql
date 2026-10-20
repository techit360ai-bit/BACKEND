CREATE UNIQUE INDEX IF NOT EXISTS idx_cofounder_relationships_active_unique
  ON platform_collection_records (
    (payload->>'projectId'),
    (payload->>'founderId'),
    (payload->>'cofounderId')
  )
  WHERE collection_name = 'cofounderRelationships'
    AND deleted_at IS NULL
    AND COALESCE(payload->>'status', '') NOT IN ('DECLINED', 'WITHDRAWN', 'ENDED');

CREATE INDEX IF NOT EXISTS idx_cofounder_records_relationship
  ON platform_collection_records ((payload->>'relationshipId'), updated_at DESC)
  WHERE collection_name IN (
    'cofounderResponsibilities',
    'cofounderObjectives',
    'cofounderDecisions',
    'cofounderActivity',
    'cofounderAlignmentSnapshots'
  )
  AND deleted_at IS NULL;
