// Row-level projection loader for the legacy dashboard analytics that now live
// in the platform backend. Each collection is queried independently through the
// Postgres platform collection table; no whole-database authority snapshot is
// loaded on the request path.
import { listRecordsLimited, withPlatformTransaction } from './platformCollectionRepository.js'

export const ADMIN_ANALYTICS_COLLECTIONS = [
  'users', 'profiles', 'projects', 'workspaceMembers', 'contributions', 'milestones',
  'subscriptions', 'creditLedger', 'paymentIntents', 'invoices',
  'usageEvents', 'userSessionLogs', 'recommendationEvents',
  'techitMoments', 'techitMomentShares', 'techitMomentReferrals', 'techitMomentEvents',
  'mentorshipRooms', 'mentorshipApplications', 'organizationPartners',
  'dealRooms', 'dealStatusEvents', 'startupCandidates', 'organizationActivityEvents',
  'networkEdges', 'connectionRequests',
  'trustVerificationProofs', 'trustMilestoneProofs',
]

function rowLimit() {
  return Math.max(100, Math.min(10_000, Number(process.env.ADMIN_ANALYTICS_ROW_LIMIT || 5000)))
}

export async function adminAnalyticsCollections() {
  return withPlatformTransaction(async client => {
    const out = {}
    for (const name of ADMIN_ANALYTICS_COLLECTIONS) {
      out[name] = await listRecordsLimited(client, name, { limit: rowLimit() })
    }
    return out
  })
}
