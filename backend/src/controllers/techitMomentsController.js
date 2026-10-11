import { generateMoments, listMoments, nextMomentPrompt, dismissMoment, getMoment, recordShare, getPublicMoment, recordVisit, analytics, activateReferral } from '../services/techitMomentsService.js'
import { intelligenceStateEnabled, intelligenceStateFallbackEnabled, syncIntelligenceState } from '../repositories/intelligenceStateRepository.js'

function send(res, value, fallback = 200) { return res.status(value?.status || fallback).json(value?.ok === false ? { error: value.error } : value) }
async function persisted(req, value) { if (!intelligenceStateEnabled() || value?.ok === false) return value; try { await syncIntelligenceState(req.user?.id || null); return value } catch (error) { if (intelligenceStateFallbackEnabled()) return value; return { ok: false, error: 'intelligence_write_temporarily_unavailable' } } }
export async function momentsList(req, res) { return send(res, await listMoments(req.user.id, req.user.role)) }
export async function momentsGenerate(req, res) { return send(res, await persisted(req, await generateMoments(req.user.id, req.user.role))) }
export async function momentPrompt(req, res) { return send(res, await nextMomentPrompt(req.user.id, req.user.role)) }
export async function momentDismiss(req, res) { return send(res, await persisted(req, await dismissMoment(req.user.id, req.params.momentId))) }
export async function momentGet(req, res) { return send(res, await getMoment(req.user.id, req.params.momentId)) }
export async function momentShare(req, res) { return send(res, await persisted(req, await recordShare(req.user.id, req.params.momentId, String(req.body?.channel || 'copy'))), 201) }
export async function publicMomentGet(req, res) { return send(res, await getPublicMoment(req.params.slug)) }
export async function publicMomentVisit(req, res) { return send(res, await recordVisit(req.params.slug, req.body?.ref, req.body?.source)) }
export async function momentReferralActivate(req, res) { return send(res, await activateReferral(req.params.referralId, req.user.id, req.body?.action || 'account_created')) }
export async function momentsAnalytics(req, res) { return send(res, await analytics(req.user.id)) }
