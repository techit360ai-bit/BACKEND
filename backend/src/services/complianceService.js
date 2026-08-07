import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'

const OWNER_FIELDS = ['ownerId', 'userId', 'founderId', 'collaboratorId', 'investorId', 'organizationId', 'createdBy']

function owned(row, userId) {
  return OWNER_FIELDS.some(field => row?.[field] === userId) || row?.id === userId
}

export function exportUserData(userId) {
  const db = readDb()
  const data = {}
  for (const [name, rows] of Object.entries(db)) {
    if (Array.isArray(rows)) data[name] = rows.filter(row => owned(row, userId))
  }
  return { exportedAt: nowIso(), subjectId: userId, data }
}

export function eraseUserData(userId) {
  return updateDb(db => {
    const erased = {}
    for (const [name, rows] of Object.entries(db)) {
      if (!Array.isArray(rows)) continue
      const before = rows.length
      db[name] = rows.filter(row => !owned(row, userId))
      erased[name] = before - db[name].length
    }
    return { erasedAt: nowIso(), subjectId: userId, erased }
  })
}

export function listConsents(userId) {
  return readDb().consentRecords.filter(row => row.userId === userId)
}

export function recordConsent(userId, body) {
  return updateDb(db => {
    const row = {
      id: createId('consent'), userId,
      purpose: String(body.purpose || ''), version: String(body.version || ''),
      granted: body.granted === true, jurisdiction: body.jurisdiction || null,
      recordedAt: nowIso(), withdrawnAt: body.granted === true ? null : nowIso(),
    }
    db.consentRecords.push(row)
    return row
  })
}

export function listRequests(userId) {
  return readDb().dataSubjectRequests.filter(row => row.userId === userId)
}

export function createRequest(userId, body) {
  return updateDb(db => {
    const row = { id: createId('dsr'), userId, type: body.type, details: body.details || '', status: 'received', createdAt: nowIso(), dueAt: body.dueAt || null }
    db.dataSubjectRequests.push(row)
    return row
  })
}

export function getResidency(userId) {
  return readDb().dataResidencyPreferences.find(row => row.userId === userId) || null
}

export function saveResidency(userId, body) {
  return updateDb(db => {
    const existing = db.dataResidencyPreferences.find(row => row.userId === userId)
    const value = { userId, region: body.region || 'eu', internationalTransfers: body.internationalTransfers === true, transferMechanism: body.transferMechanism || null, updatedAt: nowIso() }
    if (existing) Object.assign(existing, value)
    else db.dataResidencyPreferences.push(value)
    return value
  })
}

export function listRegistry(name) { return readDb()[name] || [] }
export function addRegistryRecord(name, body, userId, prefix) {
  return updateDb(db => {
    const row = { id: createId(prefix), ...body, createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
    db[name].push(row)
    return row
  })
}
