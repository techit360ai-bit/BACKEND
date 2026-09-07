import {
  addDealParticipant, closingReadiness, createDealFolder, createDocumentRequest,
  createReferenceRequest, downloadDealDocument, finalizeDealDocument, getQuestionnaire,
  getRevenueVerification, investorPack, listComparables, listDealDocuments, listDealFolders,
  listDealParticipants, listReferences, listTermSheets, recordRevenueVerification, refreshRevenueVerification, registerDealDocument,
  revokeDealDocument, revokeDealParticipant, saveQuestionnaire, saveQuestionnaireTemplate, submitReference, technicalDueDiligence,
  termSheetAction, updateIcReview, upsertClosingItem, verifyDealAudit,
} from '../services/investorDealRoomCompletionService.js'
import { syncDealAggregate, investorWriteEnabled, investorFallbackEnabled } from '../repositories/investorDealRoomRepository.js'

function result(res, value, success = 200) {
  if (value?.ok === false) {
    const status = value.error?.includes('not_found') ? 404 : value.error?.includes('permission') || value.error === 'nda_required' ? 403 : 400
    return res.status(status).json(value)
  }
  return res.status(success).json(value)
}
async function persisted(req, value) {
  if (!investorWriteEnabled() || value?.ok === false) return value
  try { await syncDealAggregate(req.user?.id || null, req.params.dealId); return value } catch (error) { console.error(JSON.stringify({ event: 'investor_postgres_write_failed', dealId: req.params.dealId, error: error.message })); if (investorFallbackEnabled('WRITE')) return value; return { ok: false, error: 'investor_write_temporarily_unavailable' } }
}
export const folders = (req, res) => result(res, listDealFolders(req.user.id, req.params.dealId))
export const folderCreate = async (req, res) => result(res, await persisted(req, createDealFolder(req.user.id, req.params.dealId, req.body)), 201)
export const requestCreate = async (req, res) => result(res, await persisted(req, createDocumentRequest(req.user.id, req.params.dealId, req.body)), 201)
export const documents = (req, res) => result(res, listDealDocuments(req.user.id, req.params.dealId))
export const documentCreate = async (req, res) => result(res, await persisted(req, registerDealDocument(req.user.id, req.params.dealId, req.body)), 201)
export const documentFinalize = async (req, res) => result(res, await persisted(req, await finalizeDealDocument(req.user.id, req.params.dealId, req.params.documentId)))
export const documentDownload = (req, res) => result(res, downloadDealDocument(req.user.id, req.params.dealId, req.params.documentId))
export const documentRevoke = async (req, res) => result(res, await persisted(req, revokeDealDocument(req.user.id, req.params.dealId, req.params.documentId)))
export const questionnaireGet = (req, res) => result(res, getQuestionnaire(req.user.id, req.params.dealId))
export const questionnaireSave = async (req, res) => result(res, await persisted(req, saveQuestionnaire(req.user.id, req.params.dealId, req.body)))
export const questionnaireTemplateSave = async (req, res) => result(res, await persisted(req, saveQuestionnaireTemplate(req.user.id, req.params.dealId, req.body)), 201)
export const technicalDdGet = (req, res) => result(res, technicalDueDiligence(req.user.id, req.params.dealId))
export const revenueGet = (req, res) => result(res, getRevenueVerification(req.user.id, req.params.dealId))
export const revenueRecord = async (req, res) => result(res, await persisted(req, recordRevenueVerification(req.user.id, req.params.dealId, req.body)), 201)
export const revenueRefresh = async (req, res) => result(res, await refreshRevenueVerification(req.user.id, req.params.dealId, req.body), 201)
export const referenceCreate = async (req, res) => result(res, await persisted(req, createReferenceRequest(req.user.id, req.params.dealId, req.body)), 201)
export const references = (req, res) => result(res, listReferences(req.user.id, req.params.dealId))
export const referenceSubmit = (req, res) => result(res, submitReference(req.params.token, req.body))
export const participantCreate = async (req, res) => result(res, await persisted(req, addDealParticipant(req.user.id, req.params.dealId, req.body)), 201)
export const participants = (req, res) => result(res, listDealParticipants(req.user.id, req.params.dealId))
export const participantRevoke = async (req, res) => result(res, await persisted(req, revokeDealParticipant(req.user.id, req.params.dealId, req.params.participantId)))
export const icUpdate = async (req, res) => result(res, await persisted(req, updateIcReview(req.user.id, req.params.dealId, req.body)))
export const termAction = async (req, res) => result(res, await persisted(req, termSheetAction(req.user.id, req.params.dealId, req.params.action, req.body)))
export const termSheets = (req, res) => result(res, listTermSheets(req.user.id, req.params.dealId))
export const closingGet = (req, res) => result(res, closingReadiness(req.user.id, req.params.dealId))
export const closingItemSave = async (req, res) => result(res, await persisted(req, upsertClosingItem(req.user.id, req.params.dealId, req.body)), req.body.id ? 200 : 201)
export const packCreate = async (req, res) => result(res, await persisted(req, investorPack(req.user.id, req.params.dealId)), 201)
export const auditVerify = (req, res) => result(res, verifyDealAudit(req.user.id, req.params.dealId))
export const comparableList = (req, res) => result(res, listComparables(req.user.id, req.query))
