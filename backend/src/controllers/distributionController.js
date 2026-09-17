import { activateDistributionReferral, createDistributionObject, distributionMetrics, getDistributionObject, recordDistributionClick, recordDistributionShare } from '../services/distributionIntelligenceService.js'

const send = (res, value, fallback = 200) => res.status(value?.status || fallback).json(value?.ok === false ? { error: value.error } : value)
export function create(req, res) { return send(res, createDistributionObject(req.user.id, req.body), 201) }
export function get(req, res) { return send(res, getDistributionObject(req.params.id, req.user?.id)) }
export function publicGet(req, res) { return send(res, getDistributionObject(req.params.id, null)) }
export function share(req, res) { return send(res, recordDistributionShare(req.user.id, req.params.id, req.body?.channel), 201) }
export function click(req, res) { return send(res, recordDistributionClick(req.params.id, req.body || {}), 201) }
export function activate(req, res) { return send(res, activateDistributionReferral(req.user.id, req.params.referralId, req.body || {})) }
export function metrics(_req, res) { return send(res, distributionMetrics()) }
