import { generateMoments, listMoments, nextMomentPrompt, dismissMoment, getMoment, recordShare, getPublicMoment, recordVisit, analytics } from '../services/techitMomentsService.js'

function send(res, value, fallback = 200) { return res.status(value?.status || fallback).json(value?.ok === false ? { error: value.error } : value) }
export function momentsList(req, res) { return send(res, listMoments(req.user.id, req.user.role)) }
export function momentsGenerate(req, res) { return send(res, generateMoments(req.user.id, req.user.role)) }
export function momentPrompt(req, res) { return send(res, nextMomentPrompt(req.user.id, req.user.role)) }
export function momentDismiss(req, res) { return send(res, dismissMoment(req.user.id, req.params.momentId)) }
export function momentGet(req, res) { return send(res, getMoment(req.user.id, req.params.momentId)) }
export function momentShare(req, res) { return send(res, recordShare(req.user.id, req.params.momentId, String(req.body?.channel || 'copy')), 201) }
export function publicMomentGet(req, res) { return send(res, getPublicMoment(req.params.slug)) }
export function publicMomentVisit(req, res) { return send(res, recordVisit(req.params.slug, req.body?.ref, req.body?.source)) }
export function momentsAnalytics(req, res) { return send(res, analytics(req.user.id)) }
