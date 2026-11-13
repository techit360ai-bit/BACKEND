import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { requireOrganizationPermission } from './organizationIntelligenceService.js'

function rows(db, key) {
  if (!db[key]) db[key] = []
  return db[key]
}

function resolveCohort(db, cohortId) {
  return (rows(db, 'organizationCohorts') || []).find(c => c.id === cohortId) || null
}

function resolveCohortMembers(db, cohort) {
  if (!cohort) return []
  const memberSet = new Map()

  // 1. Explicit members on cohort
  if (Array.isArray(cohort.members)) {
    for (const m of cohort.members) {
      const uId = typeof m === 'string' ? m : m.userId || m.id
      if (uId) {
        const p = (db.profiles || []).find(x => x.id === uId)
        memberSet.set(uId, {
          userId: uId,
          name: p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || 'Member' : 'Member',
          role: p?.role || 'collaborator',
          avatarUrl: p?.avatarUrl || null,
        })
      }
    }
  }

  // 2. Startups / Projects in this cohort or program
  const projects = (db.projects || []).filter(p =>
    (p.cohortId && p.cohortId === cohort.id) ||
    (cohort.programId && p.programId === cohort.programId)
  )
  for (const proj of projects) {
    const ownerId = proj.ownerId || proj.founderId || proj.createdBy
    if (ownerId && !memberSet.has(ownerId)) {
      const p = (db.profiles || []).find(x => x.id === ownerId)
      memberSet.set(ownerId, {
        userId: ownerId,
        name: p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || 'Founder' : 'Founder',
        role: 'founder',
        avatarUrl: p?.avatarUrl || null,
        startupName: proj.title || proj.name,
      })
    }
  }

  // 3. Organization members
  const orgMembers = (rows(db, 'organizationMemberships') || []).filter(m =>
    m.organizationId === cohort.organizationId && m.status === 'active'
  )
  for (const om of orgMembers) {
    if (!memberSet.has(om.userId)) {
      const p = (db.profiles || []).find(x => x.id === om.userId)
      memberSet.set(om.userId, {
        userId: om.userId,
        name: p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || 'Org Admin' : 'Org Admin',
        role: om.role || 'organization',
        avatarUrl: p?.avatarUrl || null,
      })
    }
  }

  return Array.from(memberSet.values())
}

function userHasCohortAccess(db, userId, cohort) {
  if (!cohort) return false
  // Check if user is org admin/member
  const isOrgMember = (rows(db, 'organizationMemberships') || []).some(m =>
    m.organizationId === cohort.organizationId && m.userId === userId && m.status === 'active'
  )
  if (isOrgMember) return true

  // Check if user is in member list
  const members = resolveCohortMembers(db, cohort)
  return members.some(m => m.userId === userId)
}

// ─── 1. Live Classes ─────────────────────────────────────────────────────────

export function scheduleCohortClass(userId, cohortId, input = {}) {
  return updateAuthorityDb(db => {
    const cohort = resolveCohort(db, cohortId)
    if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }

    // Must have org permission
    const perm = requireOrganizationPermission(userId, 'programs', cohort.organizationId)
    if (!perm.ok) return perm

    const title = String(input.title || '').trim()
    if (!title) return { ok: false, error: 'title_required', status: 400 }

    const now = nowIso()
    const classId = createId('cohort_class')
    const scheduledAt = input.scheduledAt || new Date(Date.now() + 3600000 * 24).toISOString()
    const durationMinutes = Number(input.durationMinutes) || 60
    const meetingUrl = input.meetingUrl || `https://meet.techit.network/cohort-${cohortId}-${classId.slice(-6)}`
    const instructor = input.instructor || input.hostName || 'Cohort Lead'

    const liveClass = {
      id: classId,
      cohortId,
      organizationId: cohort.organizationId,
      title,
      description: String(input.description || ''),
      scheduledAt,
      durationMinutes,
      instructor,
      meetingUrl,
      status: input.status || 'scheduled',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    }

    rows(db, 'cohortClasses').push(liveClass)

    // Notify cohort members & post system message to cohort chat
    const members = resolveCohortMembers(db, cohort)
    const formattedDate = new Date(scheduledAt).toLocaleString()
    for (const m of members) {
      if (m.userId !== userId) {
        rows(db, 'notifications').push({
          id: createId('notif'),
          userId: m.userId,
          actorId: userId,
          type: 'cohort_live_class',
          title: `[${cohort.name}] Live Class: ${title}`,
          content: `Scheduled for ${formattedDate} (${durationMinutes} mins). Host: ${instructor}.`,
          linkTo: `/feed?cohort=${cohortId}&class=${classId}`,
          read: false,
          createdAt: now,
        })
      }
    }

    // Auto-post to cohort group chat
    rows(db, 'cohortMessages').push({
      id: createId('cohort_msg'),
      cohortId,
      organizationId: cohort.organizationId,
      senderId: userId,
      senderName: instructor,
      senderRole: 'organization',
      senderAvatar: null,
      type: 'live_class_announcement',
      text: `🗓️ Live Class Scheduled: "${title}"\nDate: ${formattedDate} (${durationMinutes} mins)\nJoin link: ${meetingUrl}`,
      metadata: { classId, scheduledAt, meetingUrl },
      createdAt: now,
    })

    return { ok: true, liveClass }
  })
}

export function listCohortClasses(userId, cohortId) {
  const db = readAuthorityDb()
  const cohort = resolveCohort(db, cohortId)
  if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }
  if (!userHasCohortAccess(db, userId, cohort)) return { ok: false, error: 'access_denied', status: 403 }

  const classes = (rows(db, 'cohortClasses') || [])
    .filter(c => c.cohortId === cohortId)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  return { ok: true, cohortId, cohortName: cohort.name, classes }
}

// ─── 2. In-Mails & Broadcasts ────────────────────────────────────────────────

export function broadcastCohortInMail(userId, cohortId, input = {}) {
  return updateAuthorityDb(db => {
    const cohort = resolveCohort(db, cohortId)
    if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }

    const perm = requireOrganizationPermission(userId, 'programs', cohort.organizationId)
    if (!perm.ok) return perm

    const title = String(input.title || '').trim()
    const message = String(input.message || input.content || '').trim()
    if (!title || !message) return { ok: false, error: 'title_and_message_required', status: 400 }

    const now = nowIso()
    const broadcastId = createId('cohort_broadcast')
    const members = resolveCohortMembers(db, cohort)

    const sender = (db.profiles || []).find(p => p.id === userId)
    const senderName = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.name || 'Organization' : 'Organization'

    const broadcast = {
      id: broadcastId,
      cohortId,
      organizationId: cohort.organizationId,
      senderId: userId,
      senderName,
      title,
      message,
      channel: input.channel || 'all',
      recipientCount: members.length,
      createdAt: now,
    }
    rows(db, 'cohortBroadcasts').push(broadcast)

    // Send in-app notification & in-mail to each member
    for (const m of members) {
      rows(db, 'notifications').push({
        id: createId('notif'),
        userId: m.userId,
        actorId: userId,
        type: 'cohort_broadcast',
        title: `[${cohort.name}] ${title}`,
        content: message,
        linkTo: `/feed?cohort=${cohortId}`,
        read: false,
        createdAt: now,
      })
    }

    // Also announce in cohort WhatsApp-style group
    rows(db, 'cohortMessages').push({
      id: createId('cohort_msg'),
      cohortId,
      organizationId: cohort.organizationId,
      senderId: userId,
      senderName,
      senderRole: 'organization',
      senderAvatar: sender?.avatarUrl || null,
      type: 'broadcast',
      text: `📢 Announcement: ${title}\n\n${message}`,
      metadata: { broadcastId, title },
      createdAt: now,
    })

    return { ok: true, broadcast, recipientCount: members.length }
  })
}

// ─── 3. Group Chat (WhatsApp-style Cohort Discussion) ────────────────────────

export function listCohortMessages(userId, cohortId) {
  const db = readAuthorityDb()
  const cohort = resolveCohort(db, cohortId)
  if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }
  if (!userHasCohortAccess(db, userId, cohort)) return { ok: false, error: 'access_denied', status: 403 }

  const messages = (rows(db, 'cohortMessages') || [])
    .filter(m => m.cohortId === cohortId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  const members = resolveCohortMembers(db, cohort)

  return { ok: true, cohortId, cohortName: cohort.name, members, messages }
}

export function postCohortMessage(userId, cohortId, input = {}) {
  return updateAuthorityDb(db => {
    const cohort = resolveCohort(db, cohortId)
    if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }
    if (!userHasCohortAccess(db, userId, cohort)) return { ok: false, error: 'access_denied', status: 403 }

    const text = String(input.text || input.message || '').trim()
    const attachmentUrl = input.attachmentUrl || null
    const attachmentName = input.attachmentName || null

    if (!text && !attachmentUrl) return { ok: false, error: 'empty_message', status: 400 }

    const now = nowIso()
    const sender = (db.profiles || []).find(p => p.id === userId)
    const senderName = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.name || 'Member' : 'Member'

    const message = {
      id: createId('cohort_msg'),
      cohortId,
      organizationId: cohort.organizationId,
      senderId: userId,
      senderName,
      senderRole: sender?.role || 'collaborator',
      senderAvatar: sender?.avatarUrl || null,
      type: input.type || 'message',
      text,
      attachmentUrl,
      attachmentName,
      metadata: input.metadata || {},
      createdAt: now,
    }

    rows(db, 'cohortMessages').push(message)

    return { ok: true, message }
  })
}

// ─── 4. Assignments & Submissions ────────────────────────────────────────────

export function createCohortAssignment(userId, cohortId, input = {}) {
  return updateAuthorityDb(db => {
    const cohort = resolveCohort(db, cohortId)
    if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }

    const perm = requireOrganizationPermission(userId, 'programs', cohort.organizationId)
    if (!perm.ok) return perm

    const title = String(input.title || '').trim()
    const description = String(input.description || '').trim()
    if (!title) return { ok: false, error: 'title_required', status: 400 }

    const now = nowIso()
    const assignmentId = createId('cohort_assign')
    const dueDate = input.dueDate || new Date(Date.now() + 7 * 86400000).toISOString()
    const points = Number(input.points) || 100

    const assignment = {
      id: assignmentId,
      cohortId,
      organizationId: cohort.organizationId,
      title,
      description,
      dueDate,
      points,
      resources: Array.isArray(input.resources) ? input.resources : [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    }

    rows(db, 'cohortAssignments').push(assignment)

    // Notify cohort members
    const members = resolveCohortMembers(db, cohort)
    const formattedDue = new Date(dueDate).toLocaleDateString()
    for (const m of members) {
      if (m.userId !== userId) {
        rows(db, 'notifications').push({
          id: createId('notif'),
          userId: m.userId,
          actorId: userId,
          type: 'cohort_assignment',
          title: `[${cohort.name}] New Assignment: ${title}`,
          content: `Due: ${formattedDue} (${points} pts). Submit via cohort portal.`,
          linkTo: `/feed?cohort=${cohortId}&assignment=${assignmentId}`,
          read: false,
          createdAt: now,
        })
      }
    }

    // Auto-post to cohort discussion
    rows(db, 'cohortMessages').push({
      id: createId('cohort_msg'),
      cohortId,
      organizationId: cohort.organizationId,
      senderId: userId,
      senderName: 'Organization',
      senderRole: 'organization',
      senderAvatar: null,
      type: 'assignment_announcement',
      text: `📝 New Assignment: "${title}"\nDue Date: ${formattedDue} · ${points} Points\n${description}`,
      metadata: { assignmentId, dueDate, points },
      createdAt: now,
    })

    return { ok: true, assignment }
  })
}

export function listCohortAssignments(userId, cohortId) {
  const db = readAuthorityDb()
  const cohort = resolveCohort(db, cohortId)
  if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }
  if (!userHasCohortAccess(db, userId, cohort)) return { ok: false, error: 'access_denied', status: 403 }

  const assignments = (rows(db, 'cohortAssignments') || []).filter(a => a.cohortId === cohortId)
  const submissions = (rows(db, 'cohortSubmissions') || []).filter(s => s.cohortId === cohortId)

  const items = assignments.map(a => {
    const mySub = submissions.find(s => s.assignmentId === a.id && s.userId === userId) || null
    const allSubs = submissions.filter(s => s.assignmentId === a.id)
    return {
      ...a,
      submissionCount: allSubs.length,
      mySubmission: mySub,
      status: mySub ? (mySub.reviewedAt ? 'reviewed' : 'submitted') : (new Date(a.dueDate) < new Date() ? 'overdue' : 'pending'),
    }
  })

  return { ok: true, cohortId, cohortName: cohort.name, assignments: items }
}

export function submitCohortAssignment(userId, cohortId, assignmentId, input = {}) {
  return updateAuthorityDb(db => {
    const cohort = resolveCohort(db, cohortId)
    if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }
    if (!userHasCohortAccess(db, userId, cohort)) return { ok: false, error: 'access_denied', status: 403 }

    const assignment = (rows(db, 'cohortAssignments') || []).find(a => a.id === assignmentId && a.cohortId === cohortId)
    if (!assignment) return { ok: false, error: 'assignment_not_found', status: 404 }

    const content = String(input.content || input.submissionText || '').trim()
    const link = input.link || input.url || null
    const fileUrl = input.fileUrl || null

    if (!content && !link && !fileUrl) {
      return { ok: false, error: 'submission_cannot_be_empty', status: 400 }
    }

    const now = nowIso()
    const user = (db.profiles || []).find(p => p.id === userId)
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Student' : 'Student'

    const existingSub = (rows(db, 'cohortSubmissions') || []).find(s => s.assignmentId === assignmentId && s.userId === userId)
    let submission
    if (existingSub) {
      submission = Object.assign(existingSub, {
        content,
        link,
        fileUrl,
        status: 'submitted',
        updatedAt: now,
      })
    } else {
      submission = {
        id: createId('cohort_sub'),
        assignmentId,
        cohortId,
        organizationId: cohort.organizationId,
        userId,
        userName,
        userRole: user?.role || 'collaborator',
        userAvatar: user?.avatarUrl || null,
        content,
        link,
        fileUrl,
        status: 'submitted',
        grade: null,
        feedback: null,
        submittedAt: now,
        reviewedAt: null,
      }
      rows(db, 'cohortSubmissions').push(submission)
    }

    // Notify organization
    const orgMembers = (rows(db, 'organizationMemberships') || []).filter(m =>
      m.organizationId === cohort.organizationId && ['owner', 'admin', 'lead'].includes(m.role)
    )
    for (const om of orgMembers) {
      rows(db, 'notifications').push({
        id: createId('notif'),
        userId: om.userId,
        actorId: userId,
        type: 'cohort_submission',
        title: `[${cohort.name}] Submission from ${userName}`,
        content: `Assignment "${assignment.title}" received a submission.`,
        linkTo: `/org/incubator?cohort=${cohortId}&assignment=${assignmentId}`,
        read: false,
        createdAt: now,
      })
    }

    return { ok: true, submission }
  })
}

export function listCohortSubmissions(userId, cohortId, assignmentId) {
  const db = readAuthorityDb()
  const cohort = resolveCohort(db, cohortId)
  if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }

  const perm = requireOrganizationPermission(userId, 'programs', cohort.organizationId)
  if (!perm.ok) return perm

  const assignment = (rows(db, 'cohortAssignments') || []).find(a => a.id === assignmentId && a.cohortId === cohortId)
  if (!assignment) return { ok: false, error: 'assignment_not_found', status: 404 }

  const submissions = (rows(db, 'cohortSubmissions') || []).filter(s => s.assignmentId === assignmentId)

  return { ok: true, assignment, submissions }
}

// ─── 5. Full Cohort Hub & My Cohorts ─────────────────────────────────────────

export function getCohortHub(userId, cohortId) {
  const db = readAuthorityDb()
  const cohort = resolveCohort(db, cohortId)
  if (!cohort) return { ok: false, error: 'cohort_not_found', status: 404 }
  if (!userHasCohortAccess(db, userId, cohort)) return { ok: false, error: 'access_denied', status: 403 }

  const members = resolveCohortMembers(db, cohort)
  const classes = (rows(db, 'cohortClasses') || [])
    .filter(c => c.cohortId === cohortId)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  const assignments = (rows(db, 'cohortAssignments') || []).filter(a => a.cohortId === cohortId)
  const submissions = (rows(db, 'cohortSubmissions') || []).filter(s => s.cohortId === cohortId)
  const messages = (rows(db, 'cohortMessages') || [])
    .filter(m => m.cohortId === cohortId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-50)
  const broadcasts = (rows(db, 'cohortBroadcasts') || [])
    .filter(b => b.cohortId === cohortId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const isOrgLead = (rows(db, 'organizationMemberships') || []).some(m =>
    m.organizationId === cohort.organizationId && m.userId === userId && ['owner', 'admin', 'lead'].includes(m.role)
  )

  return {
    ok: true,
    cohort: {
      id: cohort.id,
      name: cohort.name,
      organizationId: cohort.organizationId,
      status: cohort.status || 'active',
      startDate: cohort.startDate || null,
      endDate: cohort.endDate || null,
    },
    isOrgLead,
    members,
    classes,
    assignments: assignments.map(a => {
      const mySub = submissions.find(s => s.assignmentId === a.id && s.userId === userId) || null
      return {
        ...a,
        submissionCount: submissions.filter(s => s.assignmentId === a.id).length,
        mySubmission: mySub,
      }
    }),
    recentMessages: messages,
    recentBroadcasts: broadcasts,
  }
}

export function getMyCohorts(userId) {
  const db = readAuthorityDb()
  const allCohorts = rows(db, 'organizationCohorts') || []
  const myCohorts = []

  for (const c of allCohorts) {
    if (userHasCohortAccess(db, userId, c)) {
      const org = (db.organizations || []).find(o => o.id === c.organizationId)
      const classes = (rows(db, 'cohortClasses') || []).filter(x => x.cohortId === c.id)
      const assignments = (rows(db, 'cohortAssignments') || []).filter(x => x.cohortId === c.id)
      const messages = (rows(db, 'cohortMessages') || []).filter(x => x.cohortId === c.id)
      const members = resolveCohortMembers(db, c)
      const upcoming = classes.filter(cl => new Date(cl.scheduledAt) > new Date() && cl.status !== 'completed')

      myCohorts.push({
        id: c.id,
        name: c.name,
        organizationId: c.organizationId,
        organizationName: org?.name || 'Organization',
        status: c.status || 'active',
        memberCount: members.length,
        classesCount: classes.length,
        upcomingClassesCount: upcoming.length,
        assignmentsCount: assignments.length,
        lastMessage: messages.slice(-1)[0] || null,
      })
    }
  }

  return { ok: true, cohorts: myCohorts }
}
