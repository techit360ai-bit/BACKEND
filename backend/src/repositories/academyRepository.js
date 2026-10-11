// Row-level academy store (§5 cutover).
//
// The TechIT Academy curriculum and learner evidence (academyCurricula/
// academyModules/academyProgress/academyAssessments/academyBadges/academyEvents)
// plus the cross-domain project evidence the curriculum derives from previously
// loaded the whole-database snapshot. This repository resolves the owner-scoped
// rows and the referenced project rows with bounded queries, runs the pure
// curriculum logic on that bundle and writes back only the changed academy rows.
// Gated by ACADEMY_SOURCE=postgres; the snapshot stays as the sqlite fallback.
import {
  withPlatformTransaction,
  getRecord,
  upsertRecord,
  listRecordsForOwner,
  listRecordsByField,
} from './platformCollectionRepository.js'

// Academy collections this domain writes, with the owner-bearing field each uses.
const ACADEMY_COLLECTIONS = {
  academyCurricula: ['userId'],
  academyProgress: ['userId'],
  academyAssessments: ['userId'],
  academyBadges: ['userId'],
  academyEvents: ['userId'],
}
// Cross-domain evidence the curriculum derives from. Loaded read-only.
const PROJECT_CONTEXT = {
  projects: ['ownerId', 'userId'],
  contributions: ['collaboratorId', 'userId'],
  workspaceTasks: ['assigneeId', 'assignedTo', 'userId', 'ownerId'],
  mentorshipTasks: ['assigneeId', 'assignedTo', 'userId', 'ownerId'],
  workspaceMembers: ['userId'],
  workspaces: ['ownerId', 'userId'],
  projectAnalyses: ['ownerId', 'userId'],
  ventureAnalyses: ['ownerId', 'userId'],
  validationSessions: ['userId', 'ownerId'],
  customerValidations: ['userId', 'ownerId'],
  validationRounds: ['userId', 'ownerId'],
  pivots: ['userId', 'ownerId'],
  pivotSignals: ['userId', 'ownerId'],
  mvpEvents: ['userId', 'ownerId'],
  milestones: ['userId', 'ownerId'],
}
const DOMAIN_COLLECTIONS = [...Object.keys(ACADEMY_COLLECTIONS), 'academyModules']

export function academyEnabled() {
  return process.env.ACADEMY_SOURCE === 'postgres'
}
export function academyFallbackEnabled() { return process.env.ACADEMY_FALLBACK_SQLITE !== 'false' }

async function upsertScoped(client, collectionName, row) {
  const current = await getRecord(client, collectionName, row.id)
  await upsertRecord(client, collectionName, row, {
    operation: current ? 'update' : 'insert',
    expectedVersion: current ? current.version : null,
    idempotencyKey: `${collectionName}:${row.id}:${row.updatedAt || row.createdAt || Date.now()}`,
  })
  return row
}

// Reads every collection the academy flows need for one learner, plus the
// project rows referenced through collaborator-scoped evidence.
async function buildAcademyDb(client, userId, projectId = null, curriculumId = null) {
  const db = {}
  for (const [name, ownerFields] of Object.entries(ACADEMY_COLLECTIONS)) {
    db[name] = await listRecordsForOwner(client, name, userId, { ownerFields })
  }
  for (const [name, ownerFields] of Object.entries(PROJECT_CONTEXT)) {
    db[name] = await listRecordsForOwner(client, name, userId, { ownerFields })
  }
  // Collaborator workspaces are memberships the user does not own; resolve them
  // so project access checks can follow workspaceMembers -> workspaces -> project.
  for (const member of db.workspaceMembers) {
    if (!db.workspaces.some(row => row.id === member.workspaceId)) {
      const workspace = await getRecord(client, 'workspaces', member.workspaceId)
      if (workspace) db.workspaces.push(workspace)
    }
  }
  // Projects owned by someone else that the learner collaborates on.
  const referenced = new Set()
  for (const name of ['contributions', 'workspaceTasks', 'mentorshipTasks']) for (const row of db[name]) if (row.projectId) referenced.add(row.projectId)
  for (const workspace of db.workspaces) if (workspace.projectId) referenced.add(workspace.projectId)
  for (const id of referenced) {
    if (!db.projects.some(row => row.id === id)) {
      const project = await getRecord(client, 'projects', id)
      if (project) db.projects.push(project)
    }
  }
  const resolvedProject = projectId || (curriculumId ? db.academyCurricula.find(row => row.id === curriculumId)?.projectId : null)
  if (resolvedProject) db.academyModules = await listRecordsByField(client, 'academyModules', 'projectId', resolvedProject)
  else if (curriculumId) db.academyModules = await listRecordsByField(client, 'academyModules', 'curriculumId', curriculumId)
  else db.academyModules = []
  return db
}

// Read-only bundle for the academy read paths.
export async function readAcademySources(userId, { projectId = null, curriculumId = null } = {}) {
  return withPlatformTransaction(client => buildAcademyDb(client, userId, projectId, curriculumId), { userId })
}

// Runs a pure academy mutation on the loaded bundle and persists only the
// academy rows the mutation actually changed.
export async function applyAcademyMutation(userId, { projectId = null, curriculumId = null } = {}, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildAcademyDb(client, userId, projectId, curriculumId)
    const originals = new Map()
    for (const name of DOMAIN_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const out = mutate(db) || {}
    const result = Object.prototype.hasOwnProperty.call(out, 'result') ? out.result : out
    for (const name of DOMAIN_COLLECTIONS) {
      for (const row of db[name] || []) {
        if (!row?.id) continue
        if (originals.get(`${name}:${row.id}`) === JSON.stringify(row)) continue
        await upsertScoped(client, name, row)
      }
    }
    for (const item of out.append || []) await upsertScoped(client, item.collection, item.row)
    return result
  }, { userId })
}
