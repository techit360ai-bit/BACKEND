import { updateAuthorityDb } from '../config/database.js'
import { applyDomainMutation, domainFallbackEnabled, domainStoreEnabled, runDomainRead } from './domainRepository.js'

function cofounderScope(userId, options = {}) {
  const { relationshipId = null, projectId = null } = options
  return {
    userId,
    cofounder: true,
    cofounderRelationshipId: relationshipId,
    cofounderProjectId: projectId,
    cofounderDiscovery: Boolean(options?.discovery),
    collections: [
      'cofounderRequirements',
      'cofounderRelationships',
      'cofounderResponsibilities',
      'cofounderObjectives',
      'cofounderDecisions',
      'cofounderActivity',
      'cofounderAlignmentSnapshots',
      'cofounderTeamSummaries',
      'workspaces',
      'workspaceMembers',
      'workspaceTasks',
      'milestones',
      'notifications',
    ],
  }
}

export async function runCofounderRead(userId, options, read) {
  if (!domainStoreEnabled()) return read()
  try {
    return await runDomainRead(cofounderScope(userId, options), read)
  } catch (error) {
    console.error(JSON.stringify({ event: 'cofounder_read_failed', error: error.message }))
    if (!domainFallbackEnabled()) throw error
    return read()
  }
}

export async function applyCofounderMutation(userId, options, mutate) {
  if (!domainStoreEnabled()) return updateAuthorityDb(mutate)
  try {
    return await applyDomainMutation(cofounderScope(userId, options), () => updateAuthorityDb(mutate))
  } catch (error) {
    console.error(JSON.stringify({ event: 'cofounder_write_failed', error: error.message }))
    if (!domainFallbackEnabled()) throw error
    return updateAuthorityDb(mutate)
  }
}
