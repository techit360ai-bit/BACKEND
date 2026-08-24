import { previewTrustSurfaceNotifications, refreshTrustSurface, trustSurfaceBadges, trustSurfaceHistory, trustSurfaceIntegrations, trustSurfaceProfile } from '../services/trustSurfaceService.js'

export function profile(req, res) { return res.json(trustSurfaceProfile(req.user.id)) }
export function badges(req, res) { return res.json(trustSurfaceBadges(req.user.id)) }
export function history(req, res) { return res.json(trustSurfaceHistory(req.user.id, req.query.limit)) }
export function integrations(req, res) { return res.json(trustSurfaceIntegrations(req.user.id)) }
export function refresh(req, res) { return res.json(refreshTrustSurface(req.user.id, req.params.source, 'verified')) }
export function verify(req, res) { return res.json(refreshTrustSurface(req.user.id, req.params.source, 'verified')) }
export function disconnect(req, res) { return res.json(refreshTrustSurface(req.user.id, req.params.source, 'disconnected')) }
export function notificationsPreview(req, res) { return res.json(previewTrustSurfaceNotifications(req.user.id)) }
