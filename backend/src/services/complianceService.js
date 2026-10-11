import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import {
  complianceStoreEnabled,
  loadUserRecords,
  listCollection,
  insertRecord,
  saveResidency as saveResidencyRow,
  exportOwnedRecords,
  eraseOwnedRecords,
} from '../repositories/complianceRepository.js'

const OWNER_FIELDS = ['ownerId', 'userId', 'founderId', 'collaboratorId', 'investorId', 'organizationId', 'createdBy']

function owned(row, userId) {
  return OWNER_FIELDS.some(field => row?.[field] === userId) || row?.id === userId
}

export async function exportUserData(userId) {
  if (complianceStoreEnabled()) {
    const rows = await exportOwnedRecords(userId)
    const data = {}
    for (const row of rows) {
      const { collectionName, ...record } = row
      ;(data[collectionName] ||= []).push(record)
    }
    return { exportedAt: nowIso(), subjectId: userId, data }
  }
  const db = readAuthorityDb()
  const data = {}
  for (const [name, rows] of Object.entries(db)) {
    if (Array.isArray(rows)) data[name] = rows.filter(row => owned(row, userId))
  }
  return { exportedAt: nowIso(), subjectId: userId, data }
}

export async function eraseUserData(userId) {
  if (complianceStoreEnabled()) {
    const rows = await exportOwnedRecords(userId)
    const erased = {}
    for (const row of rows) erased[row.collectionName] = (erased[row.collectionName] || 0) + 1
    await eraseOwnedRecords(userId)
    return { erasedAt: nowIso(), subjectId: userId, erased }
  }
  return updateAuthorityDb(db => {
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

export async function listConsents(userId) {
  if (complianceStoreEnabled()) return loadUserRecords('consentRecords', userId)
  return readAuthorityDb().consentRecords.filter(row => row.userId === userId)
}

export async function recordConsent(userId, body) {
  const row = {
    id: createId('consent'), userId,
    purpose: String(body.purpose || ''), version: String(body.version || ''),
    granted: body.granted === true, jurisdiction: body.jurisdiction || null,
    recordedAt: nowIso(), withdrawnAt: body.granted === true ? null : nowIso(),
  }
  if (complianceStoreEnabled()) { await insertRecord('consentRecords', row); return row }
  return updateAuthorityDb(db => { db.consentRecords.push(row); return row })
}

export async function listRequests(userId) {
  if (complianceStoreEnabled()) return loadUserRecords('dataSubjectRequests', userId)
  return readAuthorityDb().dataSubjectRequests.filter(row => row.userId === userId)
}

export async function createRequest(userId, body) {
  const row = { id: createId('dsr'), userId, type: body.type, details: body.details || '', status: 'received', createdAt: nowIso(), dueAt: body.dueAt || null }
  if (complianceStoreEnabled()) { await insertRecord('dataSubjectRequests', row); return row }
  return updateAuthorityDb(db => { db.dataSubjectRequests.push(row); return row })
}

export async function getResidency(userId) {
  if (complianceStoreEnabled()) return (await loadUserRecords('dataResidencyPreferences', userId))[0] || null
  return readAuthorityDb().dataResidencyPreferences.find(row => row.userId === userId) || null
}

export async function saveResidency(userId, body) {
  const fields = { userId, region: body.region || 'eu', internationalTransfers: body.internationalTransfers === true, transferMechanism: body.transferMechanism || null, updatedAt: nowIso() }
  if (complianceStoreEnabled()) return saveResidencyRow({ id: createId('residency'), ...fields })
  return updateAuthorityDb(db => {
    const existing = db.dataResidencyPreferences.find(row => row.userId === userId)
    if (existing) Object.assign(existing, fields)
    else db.dataResidencyPreferences.push(fields)
    return fields
  })
}

export async function listRegistry(name) {
  if (complianceStoreEnabled()) return listCollection(name)
  return readAuthorityDb()[name] || []
}

export async function addRegistryRecord(name, body, userId, prefix) {
  const row = { id: createId(prefix), ...body, createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
  if (complianceStoreEnabled()) { await insertRecord(name, row); return row }
  return updateAuthorityDb(db => { db[name].push(row); return row })
}
