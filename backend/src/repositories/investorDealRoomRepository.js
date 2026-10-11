import pg from 'pg'
import { createHash } from 'node:crypto'
import { readDb as readAuthorityDb, runDatabaseAuthority } from '../config/database.js'
import { withPlatformTransaction, getRecord, upsertRecord, listRecords, listRecordsForOwner, listRecordsByField } from './platformCollectionRepository.js'
import { createId } from '../utils/api.js'

let pool = null
const url = () => process.env.INVESTOR_DATABASE_URL || process.env.DATABASE_URL
const readEnabled = () => process.env.INVESTOR_READ_SOURCE === 'postgres'
const writeEnabled = () => process.env.INVESTOR_WRITE_SOURCE === 'postgres'
const fallback = kind => process.env[`INVESTOR_${kind}_FALLBACK_SQLITE`] !== 'false'
function getPool() { if (!url()) throw new Error('INVESTOR_DATABASE_URL or DATABASE_URL is required'); pool ||= new pg.Pool({ connectionString: url(), max: Math.max(1, Number(process.env.INVESTOR_DB_POOL_SIZE || 5)), connectionTimeoutMillis: Number(process.env.INVESTOR_DB_CONNECTION_TIMEOUT_MS || 5000), ssl: /sslmode=require/.test(url()) ? { rejectUnauthorized: process.env.INVESTOR_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined }); return pool }
async function scoped(userId, callback) { const client = await getPool().connect(); try { await client.query('BEGIN'); await client.query("SELECT set_config('app.user_id',$1,true)", [userId]); const value = await callback(client); await client.query('COMMIT'); return value } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() } }

const mapDeal = row => ({ id: row.id, projectId: row.project_id, investorId: row.investor_id, founderId: row.founder_id, state: row.state, ndaTemplateId: row.nda_template_id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, ndaRequired: true, ndaSigned: Boolean(row.nda_signed), participantRole: row.participant_role || null, diligence: { total: Number(row.diligence_total || 0), completed: Number(row.diligence_completed || 0) } })
const dealSelect = `SELECT d.*,p.role AS participant_role,EXISTS(SELECT 1 FROM investor_nda_signatures n WHERE n.deal_id=d.id AND n.user_id=d.investor_id AND n.accepted=true AND n.revoked_at IS NULL) AS nda_signed,(SELECT count(*) FROM investor_diligence_items i WHERE i.deal_id=d.id) AS diligence_total,(SELECT count(*) FROM investor_diligence_items i WHERE i.deal_id=d.id AND i.status IN ('accepted','waived')) AS diligence_completed FROM investor_deal_rooms d JOIN investor_deal_participants p ON p.deal_id=d.id AND p.user_id=$1 AND p.status='active'`
export async function listDealRooms(userId) { return scoped(userId, async client => ({ deals: (await client.query(`${dealSelect} ORDER BY d.updated_at DESC`, [userId])).rows.map(mapDeal) })) }
export async function getDealRoom(userId, dealId) { return scoped(userId, async client => { const dealRow = (await client.query(`${dealSelect} WHERE d.id=$2`, [userId, dealId])).rows[0]; if (!dealRow) return { ok: false, error: 'deal_room_not_found' }; if (dealRow.investor_id === userId && !dealRow.nda_signed) return { ok: false, error: 'nda_required' }; const internal = ['owner','reviewer','ic_member','legal','finance','read_only'].includes(dealRow.participant_role); const [items, questions, notes, ic] = await Promise.all([client.query('SELECT * FROM investor_diligence_items WHERE deal_id=$1 ORDER BY created_at', [dealId]), client.query("SELECT * FROM investor_deal_questions WHERE deal_id=$1 AND ($2::boolean OR visibility<>'investor_internal') ORDER BY created_at", [dealId, internal]), internal ? client.query('SELECT * FROM investor_internal_notes WHERE deal_id=$1 ORDER BY created_at', [dealId]) : { rows: [] }, internal ? client.query('SELECT * FROM investor_ic_reviews WHERE deal_id=$1 ORDER BY created_at', [dealId]) : { rows: [] }]); return { ok: true, deal: mapDeal(dealRow), checklist: items.rows, questions: questions.rows, notes: notes.rows, ic: ic.rows } }) }

export async function syncDealAggregate(actorId, dealId, sourceDb = null) {
  if (!writeEnabled()) return { enabled: false }
  const db = sourceDb || readAuthorityDb(); const deal = (db.dealRooms || []).find(row => row.id === dealId); if (!deal) return { enabled: true, missing: true }
  return scoped(actorId, async client => {
    await client.query(`INSERT INTO investor_deal_rooms(id,project_id,investor_id,founder_id,state,nda_template_id,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET state=EXCLUDED.state,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`, [deal.id, deal.projectId, deal.investorId, deal.founderId || null, deal.state, deal.ndaTemplateId || null, deal.status || 'active', deal.createdAt, deal.updatedAt])
    for (const row of (db.dealRoomParticipants || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_deal_participants(id,deal_id,user_id,role,status,added_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(deal_id,user_id) DO UPDATE SET role=EXCLUDED.role,status=EXCLUDED.status`, [row.id, dealId, row.userId, row.role, row.status || 'active', row.addedBy || null, row.createdAt])
    for (const row of (db.ndaSignatures || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_nda_signatures(id,deal_id,user_id,template_version,signature_hash,accepted,signed_at,revoked_at,ip_address,user_agent,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(deal_id,user_id,template_version) DO UPDATE SET accepted=EXCLUDED.accepted,signed_at=EXCLUDED.signed_at,revoked_at=EXCLUDED.revoked_at`, [row.id, dealId, row.userId, String(row.templateVersion), row.signatureHash, Boolean(row.accepted), row.signedAt || null, row.revokedAt || null, row.ipAddress || null, row.userAgent || null, row.createdAt])
    for (const row of (db.diligenceItems || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_diligence_items(id,deal_id,category,title,status,required,priority,owner_id,reviewer_id,due_date,comments,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,priority=EXCLUDED.priority,owner_id=EXCLUDED.owner_id,reviewer_id=EXCLUDED.reviewer_id,due_date=EXCLUDED.due_date,comments=EXCLUDED.comments,updated_at=EXCLUDED.updated_at`, [row.id, dealId, row.category, row.title, row.status, row.required !== false, row.priority || 'standard', row.ownerId || null, row.reviewerId || null, row.dueDate || null, row.comments || null, row.createdAt, row.updatedAt])
    for (const row of (db.dealQuestions || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_deal_questions(id,deal_id,author_id,checklist_item_id,document_id,assigned_to,visibility,status,content,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET assigned_to=EXCLUDED.assigned_to,status=EXCLUDED.status,content=EXCLUDED.content,updated_at=EXCLUDED.updated_at`, [row.id, dealId, row.authorId, row.checklistItemId || null, row.documentId || null, row.assignedTo || null, row.visibility || 'participants', row.status, row.content, row.createdAt, row.updatedAt])
    for (const row of (db.dealQuestionMessages || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_deal_question_messages(id,question_id,deal_id,author_id,visibility,content,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`, [row.id, row.questionId, dealId, row.authorId, row.visibility || 'participants', row.content, row.createdAt])
    for (const row of (db.investorInternalNotes || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_internal_notes(id,deal_id,investor_id,content,rating,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET content=EXCLUDED.content,rating=EXCLUDED.rating,updated_at=EXCLUDED.updated_at`, [row.id, dealId, row.investorId, row.content, row.rating || null, row.createdAt, row.updatedAt])
    for (const row of (db.icReviews || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_ic_reviews(id,deal_id,investor_id,thesis,risks,mitigants,strengths,open_questions,proposed_check,proposed_valuation,conditions,recommendation,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(id) DO UPDATE SET thesis=EXCLUDED.thesis,risks=EXCLUDED.risks,mitigants=EXCLUDED.mitigants,recommendation=EXCLUDED.recommendation,updated_at=EXCLUDED.updated_at`, [row.id, dealId, row.investorId, row.thesis || null, row.risks || null, row.mitigants || null, row.strengths || null, row.openQuestions || null, row.proposedCheck || null, row.proposedValuation || null, row.conditions || null, row.recommendation, row.createdAt, row.updatedAt])
    for (const row of (db.termSheetVersions || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_term_sheet_versions(id,deal_id,investor_id,version,status,terms,comments,disclaimer,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(deal_id,version) DO UPDATE SET status=EXCLUDED.status,terms=EXCLUDED.terms,comments=EXCLUDED.comments,updated_at=EXCLUDED.updated_at`, [row.id, dealId, row.investorId, row.version, row.status, JSON.stringify(row.terms || {}), JSON.stringify(row.comments || []), row.disclaimer, row.createdAt, row.updatedAt])
    for (const row of (db.dealAuditEvents || []).filter(x => x.dealId === dealId)) await client.query(`INSERT INTO investor_deal_audit_events(id,deal_id,actor_id,action,metadata,source_data_hash,prev_hash,event_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`, [row.id, dealId, row.actorId || null, row.action, JSON.stringify(row.metadata || {}), row.sourceDataHash, row.prevHash, row.eventHash, row.createdAt])
    return { enabled: true }
  })
}
export function investorReadEnabled() { return readEnabled() }
export function investorWriteEnabled() { return writeEnabled() }
export function investorFallbackEnabled(kind) { return fallback(kind) }
export async function closeInvestorDealRoomRepository() { if (pool) await pool.end(); pool = null }

// ---- Bounded platform-snapshot store (§5 cutover) --------------------------
//
// The deal-room services historically ran against the whole-database snapshot
// (via postgresAuthority or SQLite) and then mirrored the deal aggregate into
// the dedicated investor_* projection. This loader resolves only the
// caller/addressed deal set and its children, runs the synchronous service
// logic against that bounded snapshot, persists the changed platform rows and
// refreshes the investor projection. Gated by INVESTOR_SOURCE/INVESTOR_READ_SOURCE
// /INVESTOR_WRITE_SOURCE=postgres.
export function dealRoomStoreEnabled() {
  return ['INVESTOR_SOURCE', 'INVESTOR_READ_SOURCE', 'INVESTOR_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function dealRoomFallbackEnabled() { return process.env.INVESTOR_FALLBACK_SQLITE !== 'false' }

const DEAL_CHILD_BY_DEAL = ['dealRoomParticipants', 'ndaSignatures', 'diligenceItems', 'dealQuestions', 'dealQuestionMessages', 'investorInternalNotes', 'icReviews', 'termSheetVersions', 'dealAuditEvents', 'dealStatusEvents', 'dataRoomFolders', 'dataRoomDocuments', 'diligenceEvidenceLinks', 'investorQuestionnaireTemplates', 'investorQuestionnaireSubmissions', 'revenueVerifications', 'referenceRequests', 'dealClosingItems', 'investorPacks']
const RELATIONSHIP_COLLECTIONS = ['investorWatchlists', 'dealFlowSnapshots', 'investments', 'investorRelationships']
const WRITE_COLLECTIONS = ['dealRooms', ...DEAL_CHILD_BY_DEAL, 'dataRoomDocumentVersions', 'icApprovalHistory', 'notifications']

function mergeById(target, additions) {
  for (const row of additions) {
    if (!row) continue
    const index = target.findIndex(item => item.id === row.id)
    if (index >= 0) target[index] = row
    else target.push(row)
  }
  return target
}

async function loadChildren(client, name, ids, field = 'dealId') {
  if (!ids.length) return []
  const out = []
  for (const id of ids) mergeById(out, await listRecordsByField(client, name, field, id))
  return out
}

async function buildDealDb(client, { userId = null, dealId = null, allDeals = false, comparables = false, referenceToken = null } = {}) {
  const db = {}
  const globalChildren = allDeals && !userId
  db.dealRooms = allDeals
    ? (userId ? await listRecordsForOwner(client, 'dealRooms', userId, { ownerFields: ['investorId', 'founderId', 'userId', 'ownerId'] }) : await listRecords(client, 'dealRooms'))
    : (dealId ? [await getRecord(client, 'dealRooms', dealId)].filter(Boolean) : [])
  const dealIds = db.dealRooms.map(row => row.id)
  for (const name of DEAL_CHILD_BY_DEAL) db[name] = globalChildren ? await listRecords(client, name) : await loadChildren(client, name, dealIds)
  db.dataRoomDocumentVersions = globalChildren ? await listRecords(client, 'dataRoomDocumentVersions') : await loadChildren(client, 'dataRoomDocumentVersions', db.dataRoomDocuments.map(row => row.id), 'documentId')
  db.icApprovalHistory = globalChildren ? await listRecords(client, 'icApprovalHistory') : await loadChildren(client, 'icApprovalHistory', db.icReviews.map(row => row.id), 'reviewId')
  db.ndaTemplates = await listRecords(client, 'ndaTemplates')
  db.projects = []
  for (const projectId of [...new Set(db.dealRooms.map(row => row.projectId).filter(Boolean))]) mergeById(db.projects, [await getRecord(client, 'projects', projectId)])
  db.projectAnalyses = await loadChildren(client, 'projectAnalyses', db.projects.map(row => row.id), 'projectId')
  db.comparableTransactions = comparables || globalChildren ? await listRecords(client, 'comparableTransactions') : []
  if (referenceToken) {
    const tokenHash = createHash('sha256').update(String(referenceToken)).digest('hex')
    mergeById(db.referenceRequests, await listRecordsByField(client, 'referenceRequests', 'tokenHash', tokenHash))
  }
  for (const name of RELATIONSHIP_COLLECTIONS) db[name] = userId ? await listRecordsForOwner(client, name, userId, { ownerFields: ['investorId', 'ownerId', 'userId'] }) : []
  db.notifications = userId ? await listRecordsForOwner(client, 'notifications', userId, { ownerFields: ['userId'] }) : []
  return db
}

async function persistDealChanges(client, db, originals) {
  for (const name of WRITE_COLLECTIONS) {
    for (const row of db[name] || []) {
      if (!row) continue
      if (!row.id) row.id = createId('investor_row')
      const key = `${name}:${row.id}`
      const next = JSON.stringify(row)
      if (originals.get(key) === next) continue
      await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
    }
  }
}

export async function runDealRoomRead(options, read) {
  return withPlatformTransaction(async client => {
    const db = await buildDealDb(client, options)
    return runDatabaseAuthority(db, async () => read())
  }, { userId: options.userId || null })
}

export async function applyDealRoomMutation(options, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildDealDb(client, options)
    const originals = new Map()
    for (const name of WRITE_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runDatabaseAuthority(db, async () => mutate())
    await persistDealChanges(client, db, originals)
    const projectionDealId = typeof options.projectionDealId === 'function' ? options.projectionDealId(result) : (options.dealId || null)
    if (projectionDealId && options.refreshProjection !== false) {
      try { await syncDealAggregate(options.userId || null, projectionDealId, db) } catch (error) { console.error(JSON.stringify({ event: 'investor_projection_refresh_failed', dealId: projectionDealId, error: error.message })) }
    }
    return result
  }, { userId: options.userId || null })
}
