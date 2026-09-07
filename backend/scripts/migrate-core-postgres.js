import { closeIdentityPostgresProjection, initializeIdentityPostgresProjection, syncMigrationOutbox } from '../src/services/identityPostgresProjection.js'
import { closeWorkspaceProjectProjection, initializeWorkspaceProjectProjection } from '../src/services/workspaceProjectPostgresProjection.js'
import { closeContentPostgresProjection, initializeContentPostgresProjection } from '../src/services/contentPostgresProjection.js'
import { closeFinancePostgresProjection, initializeFinancePostgresProjection } from '../src/services/financePostgresProjection.js'
import { closePlatformPool, initializePlatformCollectionSchema } from '../src/repositories/platformCollectionRepository.js'

if (!process.env.DATABASE_URL && !process.env.IDENTITY_DATABASE_URL) throw new Error('DATABASE_URL or IDENTITY_DATABASE_URL is required')
const statuses = {}
try {
  statuses.identity = await initializeIdentityPostgresProjection()
  statuses.workspaceProject = await initializeWorkspaceProjectProjection()
  statuses.content = await initializeContentPostgresProjection()
  statuses.finance = await initializeFinancePostgresProjection()
  statuses.platformCollections = await initializePlatformCollectionSchema()
  if (statuses.identity.enabled) statuses.identityOutbox = await syncMigrationOutbox()
  const inconsistent = Object.entries(statuses).filter(([, value]) => value?.consistent === false)
  console.log(JSON.stringify({ event: 'core_postgres_migration_complete', statuses }))
  if (inconsistent.length) process.exitCode = 1
} finally {
  await Promise.all([closeIdentityPostgresProjection(), closeWorkspaceProjectProjection(), closeContentPostgresProjection(), closeFinancePostgresProjection(), closePlatformPool()])
}
