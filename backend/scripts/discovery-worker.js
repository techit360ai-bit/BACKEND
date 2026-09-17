import { readDb } from '../src/config/database.js'
import { loadPlatformDatabase, runWithPlatformDatabase } from '../src/repositories/platformDatabaseRepository.js'
import { getRecommendations, refreshReturnDigests } from '../src/services/discoveryService.js'
import { initializeDiscoveryInfrastructure, persistDiscoveryBatch, persistDiscoveryState, waitForDiscoveryRefresh } from '../src/services/discoveryInfrastructure.js'

await initializeDiscoveryInfrastructure()

async function refresh(userId, reason) {
  const result = process.env.PLATFORM_REQUEST_AUTHORITY === 'postgres'
    ? await runWithPlatformDatabase(() => getRecommendations(userId, { surface: 'discovery', limit: 50 }), { userId })
    : getRecommendations(userId, { surface: 'discovery', limit: 50 })
  await persistDiscoveryBatch(result)
  if (process.env.PLATFORM_REQUEST_AUTHORITY === 'postgres') await runWithPlatformDatabase(snapshot => persistDiscoveryState(snapshot), { userId })
  else await persistDiscoveryState(readDb())
  console.log(JSON.stringify({ event: 'discovery_refresh_completed', userId, reason, recommendations: result.recommendations.length }))
}

async function refreshAll(reason) {
  const profiles = process.env.PLATFORM_REQUEST_AUTHORITY === 'postgres' ? (await loadPlatformDatabase()).profiles || [] : readDb().profiles || []
  for (const profile of profiles) await refresh(profile.id, reason)
  refreshReturnDigests()
}

await refreshAll('worker_start')
const fullRefreshMs = Math.max(60_000, Number(process.env.DISCOVERY_FULL_REFRESH_MS || 900_000))
setInterval(() => void refreshAll('scheduled'), fullRefreshMs).unref()

for (;;) {
  const job = await waitForDiscoveryRefresh(10)
  if (job?.userId) await refresh(job.userId, job.reason || 'queued')
}
