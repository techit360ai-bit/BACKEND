import { createDealQuestion, createDealRoom, createIcReview, createInternalNote, createTermSheet, getDealRoom, listDealRooms, signDealNda, transitionDeal, updateDiligenceItem, addDealQuestionMessage } from '../services/investorDealRoomService.js'

function result(res, value, success = 200) { if (value?.ok === false) return res.status(value.error === 'deal_room_not_found' ? 404 : 400).json(value); return res.status(success).json(value) }
export function deals(req, res) { return res.json(listDealRooms(req.user.id)) }
export function dealCreate(req, res) { return result(res, createDealRoom(req.user.id, req.body), 201) }
export function dealGet(req, res) { const value = getDealRoom(req.user.id, req.params.dealId); return result(res, value) }
export function ndaSign(req, res) { return result(res, signDealNda(req.user.id, req.params.dealId, { ...req.body, ipAddress: req.ip, userAgent: req.get('user-agent') })) }
export function statusChange(req, res) { return result(res, transitionDeal(req.user.id, req.params.dealId, req.body.state)) }
export function checklistPatch(req, res) { return result(res, updateDiligenceItem(req.user.id, req.params.dealId, req.params.itemId, req.body)) }
export function questionCreate(req, res) { return result(res, createDealQuestion(req.user.id, req.params.dealId, req.body), 201) }
export function questionMessage(req, res) { return result(res, addDealQuestionMessage(req.user.id, req.params.dealId, req.params.questionId, req.body), 201) }
export function noteCreate(req, res) { return result(res, createInternalNote(req.user.id, req.params.dealId, req.body), 201) }
export function icCreate(req, res) { return result(res, createIcReview(req.user.id, req.params.dealId, req.body), 201) }
export function termSheetCreate(req, res) { return result(res, createTermSheet(req.user.id, req.params.dealId, req.body), 201) }
