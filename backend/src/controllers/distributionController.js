import { activateDistributionReferral, createDistributionObject, distributionMetrics, getDistributionObject, recordDistributionClick, recordDistributionShare } from '../services/distributionIntelligenceService.js'

const send = (res, value, fallback = 200) => res.status(value?.status || fallback).json(value?.ok === false ? { error: value.error } : value)
export async function create(req, res) { return send(res, await createDistributionObject(req.user.id, req.body), 201) }
export async function get(req, res) { return send(res, await getDistributionObject(req.params.id, req.user?.id)) }
export async function publicGet(req, res) { return send(res, await getDistributionObject(req.params.id, null)) }
export async function share(req, res) { return send(res, await recordDistributionShare(req.user.id, req.params.id, req.body?.channel), 201) }
export async function click(req, res) { return send(res, await recordDistributionClick(req.params.id, req.body || {}), 201) }
export async function activate(req, res) { return send(res, await activateDistributionReferral(req.user.id, req.params.referralId, req.body || {})) }
export async function metrics(_req, res) { return send(res, await distributionMetrics()) }
