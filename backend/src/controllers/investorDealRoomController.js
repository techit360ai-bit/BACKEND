import { createDealQuestionAsync, createDealRoomAsync, createIcReviewAsync, createInternalNoteAsync, createTermSheetAsync, getDealRoomAsync, listDealRoomsAsync, signDealNdaAsync, transitionDealAsync, updateDiligenceItemAsync, addDealQuestionMessageAsync } from '../services/investorDealRoomService.js'

function result(res, value, success = 200) { if (value?.ok === false) return res.status(value.error === 'deal_room_not_found' ? 404 : 400).json(value); return res.status(success).json(value) }
export async function deals(req, res) { return res.json(await listDealRoomsAsync(req.user.id)) }
export async function dealCreate(req, res) { return result(res, await createDealRoomAsync(req.user.id, req.body), 201) }
export async function dealGet(req, res) { return result(res, await getDealRoomAsync(req.user.id, req.params.dealId)) }
export async function ndaSign(req, res) { return result(res, await signDealNdaAsync(req.user.id, req.params.dealId, { ...req.body, ipAddress: req.ip, userAgent: req.get('user-agent') })) }
export async function statusChange(req, res) { return result(res, await transitionDealAsync(req.user.id, req.params.dealId, req.body.state)) }
export async function checklistPatch(req, res) { return result(res, await updateDiligenceItemAsync(req.user.id, req.params.dealId, req.params.itemId, req.body)) }
export async function questionCreate(req, res) { return result(res, await createDealQuestionAsync(req.user.id, req.params.dealId, req.body), 201) }
export async function questionMessage(req, res) { return result(res, await addDealQuestionMessageAsync(req.user.id, req.params.dealId, req.params.questionId, req.body), 201) }
export async function noteCreate(req, res) { return result(res, await createInternalNoteAsync(req.user.id, req.params.dealId, req.body), 201) }
export async function icCreate(req, res) { return result(res, await createIcReviewAsync(req.user.id, req.params.dealId, req.body), 201) }
export async function termSheetCreate(req, res) { return result(res, await createTermSheetAsync(req.user.id, req.params.dealId, req.body), 201) }
