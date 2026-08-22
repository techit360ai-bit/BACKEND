import {
  addDealParticipant, closingReadiness, createDealFolder, createDocumentRequest,
  createReferenceRequest, downloadDealDocument, finalizeDealDocument, getQuestionnaire,
  getRevenueVerification, investorPack, listComparables, listDealDocuments, listDealFolders,
  listDealParticipants, listReferences, listTermSheets, recordRevenueVerification, refreshRevenueVerification, registerDealDocument,
  revokeDealDocument, revokeDealParticipant, saveQuestionnaire, saveQuestionnaireTemplate, submitReference, technicalDueDiligence,
  termSheetAction, updateIcReview, upsertClosingItem, verifyDealAudit,
} from '../services/investorDealRoomCompletionService.js'

function result(res, value, success = 200) {
  if (value?.ok === false) {
    const status = value.error?.includes('not_found') ? 404 : value.error?.includes('permission') || value.error === 'nda_required' ? 403 : 400
    return res.status(status).json(value)
  }
  return res.status(success).json(value)
}
export const folders = (req, res) => result(res, listDealFolders(req.user.id, req.params.dealId))
export const folderCreate = (req, res) => result(res, createDealFolder(req.user.id, req.params.dealId, req.body), 201)
export const requestCreate = (req, res) => result(res, createDocumentRequest(req.user.id, req.params.dealId, req.body), 201)
export const documents = (req, res) => result(res, listDealDocuments(req.user.id, req.params.dealId))
export const documentCreate = (req, res) => result(res, registerDealDocument(req.user.id, req.params.dealId, req.body), 201)
export const documentFinalize = async (req, res) => result(res, await finalizeDealDocument(req.user.id, req.params.dealId, req.params.documentId))
export const documentDownload = (req, res) => result(res, downloadDealDocument(req.user.id, req.params.dealId, req.params.documentId))
export const documentRevoke = (req, res) => result(res, revokeDealDocument(req.user.id, req.params.dealId, req.params.documentId))
export const questionnaireGet = (req, res) => result(res, getQuestionnaire(req.user.id, req.params.dealId))
export const questionnaireSave = (req, res) => result(res, saveQuestionnaire(req.user.id, req.params.dealId, req.body))
export const questionnaireTemplateSave = (req, res) => result(res, saveQuestionnaireTemplate(req.user.id, req.params.dealId, req.body), 201)
export const technicalDdGet = (req, res) => result(res, technicalDueDiligence(req.user.id, req.params.dealId))
export const revenueGet = (req, res) => result(res, getRevenueVerification(req.user.id, req.params.dealId))
export const revenueRecord = (req, res) => result(res, recordRevenueVerification(req.user.id, req.params.dealId, req.body), 201)
export const revenueRefresh = async (req, res) => result(res, await refreshRevenueVerification(req.user.id, req.params.dealId, req.body), 201)
export const referenceCreate = (req, res) => result(res, createReferenceRequest(req.user.id, req.params.dealId, req.body), 201)
export const references = (req, res) => result(res, listReferences(req.user.id, req.params.dealId))
export const referenceSubmit = (req, res) => result(res, submitReference(req.params.token, req.body))
export const participantCreate = (req, res) => result(res, addDealParticipant(req.user.id, req.params.dealId, req.body), 201)
export const participants = (req, res) => result(res, listDealParticipants(req.user.id, req.params.dealId))
export const participantRevoke = (req, res) => result(res, revokeDealParticipant(req.user.id, req.params.dealId, req.params.participantId))
export const icUpdate = (req, res) => result(res, updateIcReview(req.user.id, req.params.dealId, req.body))
export const termAction = (req, res) => result(res, termSheetAction(req.user.id, req.params.dealId, req.params.action, req.body))
export const termSheets = (req, res) => result(res, listTermSheets(req.user.id, req.params.dealId))
export const closingGet = (req, res) => result(res, closingReadiness(req.user.id, req.params.dealId))
export const closingItemSave = (req, res) => result(res, upsertClosingItem(req.user.id, req.params.dealId, req.body), req.body.id ? 200 : 201)
export const packCreate = (req, res) => result(res, investorPack(req.user.id, req.params.dealId), 201)
export const auditVerify = (req, res) => result(res, verifyDealAudit(req.user.id, req.params.dealId))
export const comparableList = (req, res) => result(res, listComparables(req.user.id, req.query))
