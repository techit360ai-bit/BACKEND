import { closeDiscoveryInfrastructure, initializeDiscoveryInfrastructure } from '../src/services/discoveryInfrastructure.js'

if (!process.env.DISCOVERY_DATABASE_URL) throw new Error('DISCOVERY_DATABASE_URL is required')
try {
  const status = await initializeDiscoveryInfrastructure()
  console.log(JSON.stringify({ event: 'discovery_postgres_migrated', ...status }))
} finally {
  await closeDiscoveryInfrastructure()
}
