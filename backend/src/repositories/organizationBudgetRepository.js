// Row-level organization budget store (§5 cutover).
//
// Organization budgets/usage were created and mutated against the whole-DB
// snapshot. This store writes the budget rows directly to the platform
// collection store, matching the scoped reads in
// `organizationIntelligenceRepository` (which loads organizationBudgets /
// organizationUsage per organization). Gated by ORGANIZATION_SOURCE /
// ORGANIZATION_WRITE_SOURCE=postgres; the snapshot path stays as the fallback.
import { withPlatformTransaction, getRecord, upsertRecord } from './platformCollectionRepository.js'

export function organizationBudgetEnabled() {
  return process.env.ORGANIZATION_SOURCE === 'postgres' || process.env.ORGANIZATION_WRITE_SOURCE === 'postgres'
}

export async function saveOrganizationBudgetRow(row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, 'organizationBudgets', row.id)
    await upsertRecord(client, 'organizationBudgets', row, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `organization-budget:${row.id}:${row.updatedAt || row.createdAt || Date.now()}`,
    })
    return row
  }, { userId: row.createdBy || null })
}
