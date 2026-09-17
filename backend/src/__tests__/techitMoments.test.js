import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  users: [], profiles: [], projects: [], ventureIntakes: [], ventureAnalyses: [], contributions: [], workspaceTasks: [], mentorshipTasks: [], opportunityApplications: [], feedPosts: [], investorWatchlists: [],
  techitMoments: [], techitMomentShares: [], techitMomentReferrals: [], techitMomentEvents: [],
}

vi.mock('../config/database.js', () => ({ readDb: vi.fn(() => db), updateDb: vi.fn(mutator => mutator(db)) }))
const { generateMoments, listMoments, nextMomentPrompt, dismissMoment, getMoment, recordShare, getPublicMoment, recordVisit, analytics } = await import('../services/techitMomentsService.js')

beforeEach(() => { for (const value of Object.values(db)) value.length = 0 })

describe('TechIT Moments', () => {
  it('generates founder cards only from persisted evidence and does not invent missing metrics', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1', stage: 'mvp' })
    db.ventureIntakes.push({ id: 'intake-1', ownerId: 'founder-1' })
    const result = generateMoments('founder-1', 'founder')
    expect(result.ok).toBe(true)
    expect(result.moments.some(row => row.kind === 'project_started')).toBe(true)
    expect(result.moments.flatMap(row => row.metrics).some(metric => metric.key === 'customer_interviews')).toBe(false)
    expect(result.moments.flatMap(row => row.metrics).some(metric => metric.key === 'ideas_captured')).toBe(true)
  })

  it('deduplicates the same achievement scope', () => {
    db.contributions.push({ id: 'contribution-1', collaboratorId: 'collab-1', verified: true, projectId: 'project-1', milestonesShipped: 1 })
    generateMoments('collab-1', 'collaborator')
    generateMoments('collab-1', 'collaborator')
    expect(db.techitMoments.filter(row => row.kind === 'task_shipped')).toHaveLength(1)
  })

  it('keeps new Moments private until the user chooses to share', () => {
    db.feedPosts.push({ id: 'post-1', authorId: 'explorer-1', body: 'Public contribution' })
    const [moment] = generateMoments('explorer-1', 'explorer').moments
    expect(getMoment('another-user', moment.id).error).toBe('moment_not_found')
    expect(getPublicMoment(moment.publicSlug).error).toBe('moment_not_found')
    recordShare('explorer-1', moment.id, 'copy')
    const publicResult = getPublicMoment(moment.publicSlug)
    expect(publicResult.ok).toBe(true)
    expect(publicResult.moment.userId).toBeUndefined()
    expect(publicResult.moment.sourceKey).toBeUndefined()
  })

  it('returns only pending prompts and records deterministic dismissal', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1' })
    const prompt = nextMomentPrompt('founder-1', 'founder').moment
    expect(prompt?.status).toBe('pending')
    expect(dismissMoment('founder-1', prompt.id).ok).toBe(true)
    expect(nextMomentPrompt('founder-1', 'founder').moment).toBeNull()
    expect(db.techitMomentEvents.some(row => row.type === 'moment_dismissed')).toBe(true)
  })

  it('records allowlisted share channels including Facebook and an Instagram fallback', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1' })
    const [moment] = generateMoments('founder-1', 'founder').moments
    const facebook = recordShare('founder-1', moment.id, 'facebook')
    const instagram = recordShare('founder-1', moment.id, 'instagram')
    expect(facebook.channelUrl).toContain('facebook.com/sharer')
    expect(instagram.channelUrl).toBeNull()
    expect(instagram.workflow).toBe('native_share_or_copy')
    expect(recordShare('founder-1', moment.id, 'unknown').error).toBe('unsupported_share_channel')
  })

  it('attributes referrals without storing respondent identity or raw IP data', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1' })
    const [moment] = generateMoments('founder-1', 'founder').moments
    const share = recordShare('founder-1', moment.id, 'linkedin')
    expect(recordVisit(moment.publicSlug, share.shareId, 'linkedin').ok).toBe(true)
    expect(db.techitMomentReferrals[0]).not.toHaveProperty('ip')
    expect(analytics('founder-1').totals).toEqual({ moments: 1, shares: 1, referrals: 1 })
  })

  it('derives explorer and collaborator metrics on the backend', () => {
    db.opportunityApplications.push({ id: 'application-1', applicantId: 'explorer-1', status: 'matched' })
    db.workspaceTasks.push({ id: 'task-1', assigneeId: 'collab-1', status: 'completed', projectId: 'project-1' })
    expect(listMoments('explorer-1', 'explorer').moments.some(row => row.kind === 'first_match')).toBe(true)
    expect(listMoments('collab-1', 'collaborator').moments.some(row => row.kind === 'task_shipped')).toBe(true)
  })
})
