import {
  addDealParticipantAsync, closingReadinessAsync, createDealFolderAsync, createDocumentRequestAsync,
  createReferenceRequestAsync, downloadDealDocumentAsync, finalizeDealDocumentAsync, getQuestionnaireAsync,
  getRevenueVerificationAsync, investorPackAsync, listComparablesAsync, listDealDocumentsAsync, listDealFoldersAsync,
  listDealParticipantsAsync, listReferencesAsync, listTermSheetsAsync, recordRevenueVerificationAsync, refreshRevenueVerificationAsync, registerDealDocumentAsync,
  revokeDealDocumentAsync, revokeDealParticipantAsync, saveQuestionnaireAsync, saveQuestionnaireTemplateAsync, submitReferenceAsync, technicalDueDiligenceAsync,
  termSheetActionAsync, updateIcReviewAsync, upsertClosingItemAsync, verifyDealAuditAsync,
} from '../services/investorDealRoomCompletionService.js'
import { syncDealAggregate, investorWriteEnabled, investorFallbackEnabled, dealRoomStoreEnabled } from '../repositories/investorDealRoomRepository.js'

function result(res, value, success = 200) {
  if (value?.ok === false) {
    const status = value.error?.includes('not_found') ? 404 : value.error?.includes('permission') || value.error === 'nda_required' ? 403 : 400
    return res.status(status).json(value)
  }
  return res.status(success).json(value)
}
async function persisted(req, value) {
  if (dealRoomStoreEnabled() || !investorWriteEnabled() || value?.ok === false) return value
  try { await syncDealAggregate(req.user?.id || null, req.params.dealId); return value } catch (error) { console.error(JSON.stringify({ event: 'investor_postgres_write_failed', dealId: req.params.dealId, error: error.message })); if (investorFallbackEnabled('WRITE')) return value; return { ok: false, error: 'investor_write_temporarily_unavailable' } }
}
export const folders = async (req, res) => result(res, await listDealFoldersAsync(req.user.id, req.params.dealId))
export const folderCreate = async (req, res) => result(res, await persisted(req, await createDealFolderAsync(req.user.id, req.params.dealId, req.body)), 201)
export const requestCreate = async (req, res) => result(res, await persisted(req, await createDocumentRequestAsync(req.user.id, req.params.dealId, req.body)), 201)
export const documents = async (req, res) => result(res, await listDealDocumentsAsync(req.user.id, req.params.dealId))
export const documentCreate = async (req, res) => result(res, await persisted(req, await registerDealDocumentAsync(req.user.id, req.params.dealId, req.body)), 201)
export const documentFinalize = async (req, res) => result(res, await persisted(req, await finalizeDealDocumentAsync(req.user.id, req.params.dealId, req.params.documentId)))
export const documentDownload = async (req, res) => result(res, await downloadDealDocumentAsync(req.user.id, req.params.dealId, req.params.documentId))
export const documentRevoke = async (req, res) => result(res, await persisted(req, await revokeDealDocumentAsync(req.user.id, req.params.dealId, req.params.documentId)))
export const questionnaireGet = async (req, res) => result(res, await getQuestionnaireAsync(req.user.id, req.params.dealId))
export const questionnaireSave = async (req, res) => result(res, await persisted(req, await saveQuestionnaireAsync(req.user.id, req.params.dealId, req.body)))
export const questionnaireTemplateSave = async (req, res) => result(res, await persisted(req, await saveQuestionnaireTemplateAsync(req.user.id, req.params.dealId, req.body)), 201)
export const technicalDdGet = async (req, res) => result(res, await technicalDueDiligenceAsync(req.user.id, req.params.dealId))
export const revenueGet = async (req, res) => result(res, await getRevenueVerificationAsync(req.user.id, req.params.dealId))
export const revenueRecord = async (req, res) => result(res, await persisted(req, await recordRevenueVerificationAsync(req.user.id, req.params.dealId, req.body)), 201)
export const revenueRefresh = async (req, res) => result(res, await persisted(req, await refreshRevenueVerificationAsync(req.user.id, req.params.dealId, req.body)), 201)
export const referenceCreate = async (req, res) => result(res, await persisted(req, await createReferenceRequestAsync(req.user.id, req.params.dealId, req.body)), 201)
export const references = async (req, res) => result(res, await listReferencesAsync(req.user.id, req.params.dealId))
export const referenceSubmit = async (req, res) => result(res, await submitReferenceAsync(req.params.token, req.body))
export const participantCreate = async (req, res) => result(res, await persisted(req, await addDealParticipantAsync(req.user.id, req.params.dealId, req.body)), 201)
export const participants = async (req, res) => result(res, await listDealParticipantsAsync(req.user.id, req.params.dealId))
export const participantRevoke = async (req, res) => result(res, await persisted(req, await revokeDealParticipantAsync(req.user.id, req.params.dealId, req.params.participantId)))
export const icUpdate = async (req, res) => result(res, await persisted(req, await updateIcReviewAsync(req.user.id, req.params.dealId, req.body)))
export const termAction = async (req, res) => result(res, await persisted(req, await termSheetActionAsync(req.user.id, req.params.dealId, req.params.action, req.body)))
export const termSheets = async (req, res) => result(res, await listTermSheetsAsync(req.user.id, req.params.dealId))
export const closingGet = async (req, res) => result(res, await closingReadinessAsync(req.user.id, req.params.dealId))
export const closingItemSave = async (req, res) => result(res, await persisted(req, await upsertClosingItemAsync(req.user.id, req.params.dealId, req.body)), req.body.id ? 200 : 201)
export const packCreate = async (req, res) => result(res, await persisted(req, await investorPackAsync(req.user.id, req.params.dealId)), 201)
export const auditVerify = async (req, res) => result(res, await verifyDealAuditAsync(req.user.id, req.params.dealId))
export const comparableList = async (req, res) => result(res, await listComparablesAsync(req.user.id, req.query))
