// Row-level support store (§5 cutover).
//
// Support teams, tickets, cases and the user contact lookup for notifications
// live in platform_collection_records rather than the whole-database snapshot.
// This repository starts with the notification contact lookup and grows as the
// support domain is cut over. Enabled with SUPPORT_SOURCE=postgres; the
// snapshot fallback is retained in the service until the authority is deleted.
import { withPlatformTransaction, getRecord } from './platformCollectionRepository.js'

export function supportStoreEnabled() {
  return ['SUPPORT_SOURCE', 'SUPPORT_READ_SOURCE', 'SUPPORT_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function supportFallbackEnabled() { return process.env.SUPPORT_FALLBACK_SQLITE !== 'false' }

export async function loadUserContact(userId) {
  if (!userId) return null
  return withPlatformTransaction(client => getRecord(client, 'users', userId))
}
