// Row-level organization access resolution (§5 cutover).
//
// The organization permission gate previously read the whole-database snapshot
// to resolve a caller's active context, membership, legacy org ownership and
// organization-owned projects. This repository resolves those rows with bounded
// per-owner / per-organization queries. Gated by ORGANIZATION_SOURCE=postgres
// (or an authoritative authorization source); the snapshot stays as the
// sqlite fallback.
import { withPlatformTransaction, getRecord, listRecords, listRecordsForOwner } from './platformCollectionRepository.js'

export function organizationAccessEnabled() {
  return process.env.ORGANIZATION_SOURCE === 'postgres' || process.env.ORGANIZATION_READ_SOURCE === 'postgres' || process.env.AUTHORIZATION_SOURCE === 'postgres'
}
export function organizationAccessFallbackEnabled() { return process.env.ORGANIZATION_FALLBACK_SQLITE !== 'false' }

async function buildOrganizationAccessDb(client, userId, requestedOrganizationId = null) {
  const activeContexts = await listRecordsForOwner(client, 'activeContexts', userId, { ownerFields: ['userId'] })
  const organizationMemberships = await listRecordsForOwner(client, 'organizationMemberships', userId, { ownerFields: ['userId'] })
  const organizationDashboards = await listRecordsForOwner(client, 'organizationDashboards', userId, { ownerFields: ['ownerId', 'userId'] })
  const candidate = requestedOrganizationId || activeContexts.find(row => row.status === 'active')?.organizationId || userId
  const organizations = []
  for (const id of [requestedOrganizationId, candidate, userId]) {
    if (!id || organizations.some(row => row.id === id)) continue
    const org = await getRecord(client, 'organizations', id)
    if (org) organizations.push(org)
  }
  const projects = []
  for (const id of [candidate, requestedOrganizationId, userId]) {
    if (!id || projects.some(row => row.organizationId === id)) continue
    projects.push(...await listRecords(client, 'projects', { organizationId: id }))
  }
  return { activeContexts, organizationMemberships, organizationDashboards, organizations, projects }
}

export async function loadOrganizationAccess(userId, requestedOrganizationId = null) {
  return withPlatformTransaction(client => buildOrganizationAccessDb(client, userId, requestedOrganizationId), { userId })
}
