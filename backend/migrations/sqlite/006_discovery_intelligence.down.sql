DELETE FROM app_collections
WHERE name IN (
  'recommendationProfiles',
  'recommendationPreferences',
  'recommendationConfigs',
  'recommendations',
  'recommendationReasons',
  'recommendationEvents',
  'recommendationFeedback',
  'recommendationExposures',
  'userInterests',
  'userIntents',
  'userSkills',
  'entityRelationships',
  'networkEdges',
  'userActivityStates',
  'catchUpStates'
);
