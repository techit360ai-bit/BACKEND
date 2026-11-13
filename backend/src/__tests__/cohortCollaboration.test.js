import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(),
  writeAuthorityDb: vi.fn(),
  updateAuthorityDb: vi.fn(),
}))

import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import {
  scheduleCohortClass,
  listCohortClasses,
  broadcastCohortInMail,
  listCohortMessages,
  postCohortMessage,
  createCohortAssignment,
  listCohortAssignments,
  submitCohortAssignment,
  listCohortSubmissions,
  getCohortHub,
  getMyCohorts,
} from '../services/cohortCollaborationService.js'

describe('Cohort Collaboration & Cross-Role Interaction', () => {
  let db

  beforeEach(() => {
    db = {
      organizations: [
        { id: 'org_1', name: 'TechIT Ventures Accelerator' },
      ],
      organizationMemberships: [
        { id: 'om_1', organizationId: 'org_1', userId: 'user_org_lead', role: 'owner', status: 'active' },
      ],
      activeContexts: [
        { id: 'ctx_1', userId: 'user_org_lead', organizationId: 'org_1', status: 'active' },
      ],
      organizationCohorts: [
        {
          id: 'cohort_alpha',
          organizationId: 'org_1',
          name: 'Batch Alpha 2026',
          members: ['user_founder_1', 'user_collab_1'],
          status: 'active',
        },
      ],
      profiles: [
        { id: 'user_org_lead', firstName: 'Sarah', lastName: 'Director', role: 'organisation', isOnboarded: true },
        { id: 'user_founder_1', firstName: 'Alex', lastName: 'Founder', role: 'founder', isOnboarded: true },
        { id: 'user_collab_1', firstName: 'Jordan', lastName: 'Engineer', role: 'collaborator', isOnboarded: true },
      ],
      cohortClasses: [],
      cohortMessages: [],
      cohortAssignments: [],
      cohortSubmissions: [],
      cohortBroadcasts: [],
      notifications: [],
      projects: [],
    }

    readAuthorityDb.mockReturnValue(db)
    updateAuthorityDb.mockImplementation(fn => fn(db))
  })

  it('allows organization lead to schedule a live class with auto-broadcast and group post', () => {
    const scheduled = scheduleCohortClass('user_org_lead', 'cohort_alpha', {
      title: 'Product Pitching & Demo Day Prep',
      description: 'Review pitch decks and live Q&A',
      scheduledAt: '2026-11-20T14:00:00Z',
      durationMinutes: 45,
      instructor: 'Sarah Director',
    })

    expect(scheduled.ok).toBe(true)
    expect(scheduled.liveClass.title).toBe('Product Pitching & Demo Day Prep')
    expect(scheduled.liveClass.meetingUrl).toContain('https://meet.techit.network/cohort-cohort_alpha')

    // Verify cohort members received in-app notifications
    const founderNotif = db.notifications.find(n => n.userId === 'user_founder_1')
    expect(founderNotif).toBeDefined()
    expect(founderNotif.title).toContain('[Batch Alpha 2026] Live Class')

    // Verify auto-post in WhatsApp-style cohort group discussion
    const classMsg = db.cohortMessages.find(m => m.cohortId === 'cohort_alpha')
    expect(classMsg).toBeDefined()
    expect(classMsg.text).toContain('Live Class Scheduled')
  })

  it('allows organization lead to broadcast an in-mail announcement', () => {
    const broadcast = broadcastCohortInMail('user_org_lead', 'cohort_alpha', {
      title: 'Office Hours with Seed Investors',
      message: 'Slots are open this Friday from 2pm to 5pm UTC.',
    })

    expect(broadcast.ok).toBe(true)
    expect(broadcast.recipientCount).toBeGreaterThan(0)

    const collabNotif = db.notifications.find(n => n.userId === 'user_collab_1')
    expect(collabNotif).toBeDefined()
    expect(collabNotif.title).toContain('Office Hours with Seed Investors')
    expect(collabNotif.content).toContain('Slots are open this Friday')
  })

  it('allows cohort members (founder, collaborator) to converse in WhatsApp-style group chat', () => {
    // Founder sends message
    const msg1 = postCohortMessage('user_founder_1', 'cohort_alpha', {
      text: 'Hey team, does anyone have experience with Stripe Webhooks in NestJS?',
    })
    expect(msg1.ok).toBe(true)

    // Collaborator replies
    const msg2 = postCohortMessage('user_collab_1', 'cohort_alpha', {
      text: 'Yes! Check the webhook signature verification using raw buffer.',
    })
    expect(msg2.ok).toBe(true)

    const list = listCohortMessages('user_founder_1', 'cohort_alpha')
    expect(list.ok).toBe(true)
    expect(list.messages).toHaveLength(2)
    expect(list.messages[0].senderName).toBe('Alex Founder')
    expect(list.messages[1].senderName).toBe('Jordan Engineer')
  })

  it('allows assignments to be created and submitted by cohort members', () => {
    // Org creates assignment
    const created = createCohortAssignment('user_org_lead', 'cohort_alpha', {
      title: 'Architecture Blueprint Submission',
      description: 'Upload your system architecture PDF or Figma link',
      dueDate: '2026-11-25T23:59:59Z',
      points: 100,
    })
    expect(created.ok).toBe(true)

    // Founder submits
    const sub = submitCohortAssignment('user_founder_1', 'cohort_alpha', created.assignment.id, {
      content: 'Here is our architecture link and documentation notes.',
      link: 'https://figma.com/file/architecture-blueprint',
    })
    expect(sub.ok).toBe(true)
    expect(sub.submission.status).toBe('submitted')

    // Org lists submissions
    const subsList = listCohortSubmissions('user_org_lead', 'cohort_alpha', created.assignment.id)
    expect(subsList.ok).toBe(true)
    expect(subsList.submissions).toHaveLength(1)
    expect(subsList.submissions[0].userName).toBe('Alex Founder')
  })

  it('ports cohort access into getMyCohorts for founders and collaborators', () => {
    const founderCohorts = getMyCohorts('user_founder_1')
    expect(founderCohorts.ok).toBe(true)
    expect(founderCohorts.cohorts).toHaveLength(1)
    expect(founderCohorts.cohorts[0].id).toBe('cohort_alpha')
    expect(founderCohorts.cohorts[0].organizationName).toBe('TechIT Ventures Accelerator')

    const collabCohorts = getMyCohorts('user_collab_1')
    expect(collabCohorts.ok).toBe(true)
    expect(collabCohorts.cohorts).toHaveLength(1)
    expect(collabCohorts.cohorts[0].name).toBe('Batch Alpha 2026')
  })
})
