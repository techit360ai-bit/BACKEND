import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb } from '../config/database.js'
import { createDomainChallenge, registryCheck, reviewVerificationOperation, verificationOperations, verifyDomainChallenge } from '../services/registryVerificationService.js'

let db
beforeEach(() => {
  db = {
    organizations: [{ id: 'org1', name: 'Acme' }],
    organizationMemberships: [{ userId: 'u1', organizationId: 'org1', role: 'owner', status: 'active' }],
    organizationDomains: [], organizationRegistryChecks: [], organizationDomainChallenges: [], evidenceObjects: [], manualReviews: [], countryRegistryConfigurations: [],
  }
  readDb.mockReturnValue(db)
  updateDb.mockImplementation(mutator => mutator(db))
  delete process.env.REGISTRY_NIGERIA_URL
  delete process.env.REGISTRY_NIGERIA_API_KEY
})

describe('optional external verification adapters', () => {
  it('records manual review when registry credentials are unavailable', () => {
    const result = registryCheck('u1', 'org1', { country: 'Nigeria', registrationNumber: 'CAC-123' })
    expect(result.ok).toBe(true)
    expect(result.manualReviewRequired).toBe(true)
    expect(result.check.status).toBe('manual_review_required')
  })

  it('returns a private DNS token to the owner and redacts it from operations', async () => {
    const created = createDomainChallenge('u1', 'org1', { domain: 'acme.example' })
    expect(created.ok).toBe(true)
    expect(created.challenge.token).toBeTruthy()
    const operations = verificationOperations()
    expect(operations.domainChallenges[0].token).toBeUndefined()
    const verified = await verifyDomainChallenge('u1', created.challenge.id)
    expect(verified.ok).toBe(true)
    expect(verified.challenge.token).toBeUndefined()
  })

  it('supports an explicit admin decision for a pending registry operation', () => {
    const created = registryCheck('u1', 'org1', { country: 'Nigeria', registrationNumber: 'CAC-999' })
    const reviewed = reviewVerificationOperation('admin1', 'registry', created.check.id, { decision: 'verified', note: 'Reviewed registry certificate' })
    expect(reviewed.ok).toBe(true)
    expect(reviewed.operation.status).toBe('verified')
    expect(db.manualReviews[0].operationId).toBe(created.check.id)
  })
})
