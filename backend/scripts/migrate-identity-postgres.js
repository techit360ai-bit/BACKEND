import { closeIdentityPostgresProjection, initializeIdentityPostgresProjection } from '../src/services/identityPostgresProjection.js'

if (!process.env.IDENTITY_DATABASE_URL && !process.env.DATABASE_URL) throw new Error('IDENTITY_DATABASE_URL or DATABASE_URL is required')
try {
  const status = await initializeIdentityPostgresProjection()
  console.log(JSON.stringify({ event: 'identity_postgres_migrated', ...status }))
} finally {
  await closeIdentityPostgresProjection()
}
