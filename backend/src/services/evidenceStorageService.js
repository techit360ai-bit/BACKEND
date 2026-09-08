import crypto from 'node:crypto'
import net from 'node:net'
import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { safeFetch } from './outboundHttpService.js'

const allowedTypes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/plain'])
const maxBytes = () => Math.max(1024, Number(process.env.EVIDENCE_MAX_BYTES || 25 * 1024 * 1024))
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
const hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding)
const hash = value => crypto.createHash('sha256').update(value).digest('hex')

function storageConfig() {
  const endpoint = (process.env.EVIDENCE_STORAGE_ENDPOINT || '').replace(/\/$/, '')
  const bucket = process.env.EVIDENCE_STORAGE_BUCKET || ''
  if (!endpoint || !bucket || !process.env.EVIDENCE_STORAGE_ACCESS_KEY || !process.env.EVIDENCE_STORAGE_SECRET_KEY) return null
  return { endpoint, bucket, region: process.env.EVIDENCE_STORAGE_REGION || 'us-east-1', access: process.env.EVIDENCE_STORAGE_ACCESS_KEY, secret: process.env.EVIDENCE_STORAGE_SECRET_KEY }
}
function presign(method, key, expires = 900) {
  const config = storageConfig(); if (!config) return null
  const url = new URL(`${config.endpoint}/${config.bucket}/${key.split('/').map(encode).join('/')}`); const now = new Date(); const date = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const short = date.slice(0, 8)
  const credential = `${config.access}/${short}/${config.region}/s3/aws4_request`
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256'); url.searchParams.set('X-Amz-Credential', credential); url.searchParams.set('X-Amz-Date', date); url.searchParams.set('X-Amz-Expires', String(expires)); url.searchParams.set('X-Amz-SignedHeaders', 'host')
  const query = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encode(k)}=${encode(v)}`).join('&')
  const canonical = `${method}\n${url.pathname}\n${query}\nhost:${url.host}\n\nhost\nUNSIGNED-PAYLOAD`; const scope = `${short}/${config.region}/s3/aws4_request`
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secret}`, short), config.region), 's3'), 'aws4_request'); const signature = hmac(signingKey, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`, 'hex')
  url.searchParams.set('X-Amz-Signature', signature); return url.toString()
}

export function createEvidenceUpload(userId, requestId, input = {}) {
  const contentType = String(input.contentType || '').toLowerCase(); const sizeBytes = Number(input.sizeBytes || 0)
  if (!allowedTypes.has(contentType)) return { ok: false, error: 'unsupported_evidence_type' }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes()) return { ok: false, error: 'invalid_evidence_size', maxBytes: maxBytes() }
  const db = readAuthorityDb(); const request = (db.verificationRequests || []).find(row => row.id === requestId && row.userId === userId)
  if (!request) return { ok: false, error: 'verification_request_not_found' }
  const objectId = createId('evidence_object'); const extension = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'text/plain': 'txt' }[contentType]; const objectKey = `verification/${userId}/${requestId}/${objectId}.${extension}`
  const uploadUrl = presign('PUT', objectKey); if (!uploadUrl) return { ok: false, error: 'evidence_storage_not_configured' }
  return updateAuthorityDb(state => { const row = { id: objectId, userId, requestId, objectKey, contentType, sizeBytes, status: 'upload_pending', malwareStatus: 'pending', createdAt: nowIso(), updatedAt: nowIso() }; state.evidenceObjects.push(row); return { ok: true, object: row, uploadUrl, requiredHeaders: { 'Content-Type': contentType } } })
}
async function clamScan(buffer) {
  if (!process.env.CLAMAV_HOST) return process.env.NODE_ENV === 'production' ? { clean: false, error: 'malware_scanner_not_configured' } : { clean: true, engine: 'development_bypass' }
  return await new Promise(resolve => { const socket = net.createConnection({ host: process.env.CLAMAV_HOST, port: Number(process.env.CLAMAV_PORT || 3310) }); const chunks = [Buffer.from('zINSTREAM\0')]; for (let offset = 0; offset < buffer.length; offset += 65536) { const part = buffer.subarray(offset, offset + 65536); const size = Buffer.alloc(4); size.writeUInt32BE(part.length); chunks.push(size, part) } chunks.push(Buffer.alloc(4)); let response = ''; socket.setTimeout(15000); socket.on('connect', () => socket.end(Buffer.concat(chunks))); socket.on('data', data => { response += data }); socket.on('end', () => resolve({ clean: /OK/.test(response), engine: 'clamav', response: response.trim() })); socket.on('timeout', () => { socket.destroy(); resolve({ clean: false, error: 'malware_scan_timeout' }) }); socket.on('error', () => resolve({ clean: false, error: 'malware_scan_unavailable' })) })
}
function matchesDeclaredType(buffer, contentType) {
  if (contentType === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-'
  if (contentType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (contentType === 'image/jpeg') return buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
  return true
}
async function validatePrivateObject({ objectKey, contentType, expectedSizeBytes }) {
  const downloadUrl = presign('GET', objectKey, 300); if (!downloadUrl) return { ok: false, error: 'evidence_storage_not_configured' }
  try {
    const response = await safeFetch(downloadUrl, { signal: AbortSignal.timeout(20000) }, { schemes: ['https'], allowHosts: new URL(downloadUrl).hostname ? [new URL(downloadUrl).hostname] : [] })
    if (!response.ok) return { ok: false, error: 'evidence_object_unavailable' }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length !== expectedSizeBytes || buffer.length > maxBytes()) return { ok: false, error: 'evidence_size_mismatch' }
    if (!matchesDeclaredType(buffer, contentType)) return { ok: false, error: 'evidence_signature_mismatch' }
    const scan = await clamScan(buffer)
    return scan.clean ? { ok: true, sha256: hash(buffer), scan } : { ok: false, error: scan.error || 'malware_detected', scan }
  } catch { return { ok: false, error: 'evidence_scan_failed' } }
}

export function createPrivateUpload({ namespace, ownerId, objectId, contentType, sizeBytes }) {
  const normalizedType = String(contentType || '').toLowerCase(); const bytes = Number(sizeBytes || 0)
  if (!allowedTypes.has(normalizedType)) return { ok: false, error: 'unsupported_evidence_type' }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > maxBytes()) return { ok: false, error: 'invalid_evidence_size', maxBytes: maxBytes() }
  const extension = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'text/plain': 'txt' }[normalizedType]
  const safeNamespace = String(namespace || 'private').replace(/[^a-zA-Z0-9/_-]/g, '')
  const objectKey = `${safeNamespace}/${ownerId}/${objectId}.${extension}`
  const uploadUrl = presign('PUT', objectKey)
  if (!uploadUrl) return { ok: false, error: 'evidence_storage_not_configured' }
  return { ok: true, objectKey, uploadUrl, requiredHeaders: { 'Content-Type': normalizedType } }
}

export async function finalizePrivateUpload({ objectKey, contentType, expectedSizeBytes }) {
  return validatePrivateObject({ objectKey, contentType, expectedSizeBytes })
}

export function privateDownloadUrl(objectKey, expires = 300) { return presign('GET', objectKey, expires) }

export async function finalizeEvidenceUpload(userId, objectId) {
  const object = (readAuthorityDb().evidenceObjects || []).find(row => row.id === objectId && row.userId === userId); if (!object) return { ok: false, error: 'evidence_object_not_found' }
  const downloadUrl = presign('GET', object.objectKey, 300); if (!downloadUrl) return { ok: false, error: 'evidence_storage_not_configured' }
  const result = await validatePrivateObject({ objectKey: object.objectKey, contentType: object.contentType, expectedSizeBytes: object.sizeBytes })
  return updateAuthorityDb(db => { const row = db.evidenceObjects.find(item => item.id === objectId); row.status = result.ok ? 'available' : 'quarantined'; row.malwareStatus = result.ok ? 'clean' : 'infected_or_unavailable'; row.sha256 = result.sha256 || null; row.scan = result.scan || null; row.updatedAt = nowIso(); return result.ok ? { ok: true, object: row } : { ok: false, error: result.error, object: row } })
}
export function evidenceObject(userId, objectId, admin = false) { const row = (readAuthorityDb().evidenceObjects || []).find(item => item.id === objectId && (admin || item.userId === userId)); if (!row || row.status !== 'available') return { ok: false, error: 'evidence_object_unavailable' }; return { ok: true, object: row, downloadUrl: presign('GET', row.objectKey, 300) } }
