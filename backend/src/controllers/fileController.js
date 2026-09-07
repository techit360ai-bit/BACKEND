import { readDb, writeDb } from '../config/database.js'
import { createId, nowIso, requireBodyString, timeAgo } from '../utils/api.js'
import { listFiles as listFilesPostgres, contentReadEnabled, contentReadFallbackEnabled } from '../repositories/contentRepository.js'

const FILE_TYPES = new Set(['document', 'image', 'code'])
const ITEM_TYPES = new Set(['folder', 'file'])

function toFile(item) {
  return {
    ...item,
    modified: timeAgo(item.updatedAt || item.createdAt),
  }
}

export async function listFiles(req, res) {
  const db = readDb()
  const workspaceId = req.query.workspaceId || 'default'
  let files
  if (contentReadEnabled()) {
    try { files = (await listFilesPostgres(req.user.id, workspaceId)).map(toFile) } catch (error) {
      if (!contentReadFallbackEnabled()) throw error
      files = db.files.filter(f => f.ownerId === req.user.id && f.workspaceId === workspaceId).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).map(toFile)
    }
  } else files = db.files.filter(f => f.ownerId === req.user.id && f.workspaceId === workspaceId).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).map(toFile)
  return res.json({
    files,
    storage: {
      usedBytes: files.reduce((sum, f) => sum + (Number(f.sizeBytes) || 0), 0),
      limitBytes: 100 * 1024 * 1024 * 1024,
    },
  })
}

export function createFile(req, res) {
  const db = readDb()
  const name = requireBodyString(res, req.body.name, 'Name')
  if (!name) return
  const type = ITEM_TYPES.has(req.body.type) ? req.body.type : 'file'
  const fileType = FILE_TYPES.has(req.body.fileType) ? req.body.fileType : inferFileType(name)
  const now = nowIso()
  const file = {
    id: createId(type === 'folder' ? 'folder' : 'file'),
    ownerId: req.user.id,
    workspaceId: req.body.workspaceId || 'default',
    name,
    type,
    size: req.body.size || (type === 'folder' ? '' : '0 KB'),
    sizeBytes: Number(req.body.sizeBytes) || 0,
    fileType: type === 'folder' ? undefined : fileType,
    url: req.body.url || null,
    createdAt: now,
    updatedAt: now,
  }
  db.files.push(file)
  writeDb(db)
  return res.status(201).json(toFile(file))
}

export function deleteFile(req, res) {
  const db = readDb()
  const before = db.files.length
  db.files = db.files.filter(f => !(f.id === req.params.id && f.ownerId === req.user.id))
  if (db.files.length === before) return res.status(404).json({ error: 'File not found' })
  writeDb(db)
  return res.json({ ok: true })
}

function inferFileType(name) {
  const lower = name.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return 'image'
  if (/\.(js|ts|tsx|jsx|py|go|rs|md|json|yaml|yml|css|html)$/.test(lower)) return 'code'
  return 'document'
}
