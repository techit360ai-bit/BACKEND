import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = { users: [], profiles: [], techitMoments: [], achievements: [], projectMilestones: [], validationSessions: [], investorReadiness: [], distributionObjects: [], distributionShares: [], distributionAttributions: [], growthEvents: [] }
vi.mock('../config/database.js', () => ({ readDb: vi.fn(() => db), updateDb: vi.fn(mutator => mutator(db)) }))
const { createDistributionObject, getDistributionObject, recordDistributionShare, recordDistributionClick, activateDistributionReferral, distributionMetrics } = await import('../services/distributionIntelligenceService.js')

beforeEach(() => Object.values(db).forEach(value => Array.isArray(value) && (value.length = 0)))

describe('Distribution Intelligence foundation', () => {
  it('creates a private-safe public object only for the source owner', () => {
    db.techitMoments.push({ id: 'moment-1', userId: 'founder-1' })
    expect(createDistributionObject('other', { sourceType: 'moment', sourceId: 'moment-1', visibility: 'PUBLIC' }).error).toBe('distribution_source_forbidden')
    const result = createDistributionObject('founder-1', { sourceType: 'moment', sourceId: 'moment-1', visibility: 'PUBLIC', title: 'Validation complete', description: 'Three assumptions tested', preview: 'No private notes', destinationRoute: '/diagnostic' })
    expect(result.ok).toBe(true)
    expect(getDistributionObject(result.object.id).object.title).toBe('Validation complete')
  })

  it('tracks share, visit, signup, activation, and K-factor inputs', () => {
    db.techitMoments.push({ id: 'moment-1', userId: 'founder-1' })
    const object = createDistributionObject('founder-1', { sourceType: 'moment', sourceId: 'moment-1', visibility: 'PUBLIC', title: 'Milestone' }).object
    const share = recordDistributionShare('founder-1', object.id, 'copy')
    const click = recordDistributionClick(object.id, { source: 'linkedin' })
    expect(click.ok).toBe(true)
    expect(activateDistributionReferral('new-user', click.referralId, { activationAction: 'account_created' }).status).toBe('activated')
    const metrics = distributionMetrics().metrics
    expect(metrics.shares).toBe(1)
    expect(metrics.signups).toBe(1)
    expect(metrics.activated).toBe(1)
    expect(metrics.viralCoefficient).toBe(1)
    expect(share.attributionId).toBe(object.attributionId)
  })

  it('does not expose private objects publicly', () => {
    const object = createDistributionObject('founder-1', { sourceType: 'achievement', visibility: 'PRIVATE', title: 'Private' }).object
    expect(getDistributionObject(object.id).error).toBe('distribution_private')
    expect(recordDistributionShare('founder-1', object.id, 'copy').error).toBe('distribution_not_shareable')
  })
})
