import { generateMoments, listMoments, nextMomentPrompt, dismissMoment, getMoment, recordShare, getPublicMoment, recordVisit, analytics } from '../services/techitMomentsService.js'
import { intelligenceStateEnabled, intelligenceStateFallbackEnabled, syncIntelligenceState } from '../repositories/intelligenceStateRepository.js'

function send(res, value, fallback = 200) { return res.status(value?.status || fallback).json(value?.ok === false ? { error: value.error } : value) }
async function persisted(req, value) { if (!intelligenceStateEnabled() || value?.ok === false) return value; try { await syncIntelligenceState(req.user?.id || null); return value } catch (error) { if (intelligenceStateFallbackEnabled()) return value; return { ok: false, error: 'intelligence_write_temporarily_unavailable' } } }
export function momentsList(req, res) { return send(res, listMoments(req.user.id, req.user.role)) }
export async function momentsGenerate(req, res) { return send(res, await persisted(req, generateMoments(req.user.id, req.user.role))) }
export function momentPrompt(req, res) { return send(res, nextMomentPrompt(req.user.id, req.user.role)) }
export async function momentDismiss(req, res) { return send(res, await persisted(req, dismissMoment(req.user.id, req.params.momentId))) }
export function momentGet(req, res) { return send(res, getMoment(req.user.id, req.params.momentId)) }
export async function momentShare(req, res) { return send(res, await persisted(req, recordShare(req.user.id, req.params.momentId, String(req.body?.channel || 'copy'))), 201) }
export function publicMomentGet(req, res) { return send(res, getPublicMoment(req.params.slug)) }
export function publicMomentVisit(req, res) { return send(res, recordVisit(req.params.slug, req.body?.ref, req.body?.source)) }
export function momentsAnalytics(req, res) { return send(res, analytics(req.user.id)) }
