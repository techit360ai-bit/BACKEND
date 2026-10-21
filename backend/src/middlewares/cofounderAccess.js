import { readAuthorityDb } from '../config/database.js'
import { cofounderModeEnabled } from '../config/runtimeConfig.js'
import { runCofounderRead } from '../repositories/cofounderRepository.js'
import { rows } from '../services/cofounderModel.js'
import { resolveCofounderRelationshipFromDb } from '../services/cofounderRelationshipService.js'

export function requireCofounderFeature(req, res, next) {
  if (!cofounderModeEnabled(req.user?.id)) return res.status(404).json({ error: 'cofounder_mode_disabled' })
  return next()
}

function sendAccessError(res, access) {
  const status = access.status || (access.error === 'cofounder_permission_required' ? 403 : 404)
  return res.status(status).json({ error: access.error })
}

export function requireCofounderRelationship({ param = 'relationshipId', statuses = null, permission = null } = {}) {
  return async (req, res, next) => {
    const relationshipId = req.params[param]
    if (!relationshipId) return res.status(400).json({ error: 'relationship_id_required' })
    try {
      const access = await runCofounderRead(req.user.id, { relationshipId }, () => {
        const db = readAuthorityDb()
        return resolveCofounderRelationshipFromDb(db, req.user.id, relationshipId, { statuses, permission })
      })
      if (access.ok === false) return sendAccessError(res, access)
      req.cofounderAccess = access
      return next()
    } catch (error) {
      console.error(JSON.stringify({ event: 'cofounder_access_failed', error: error.message }))
      return res.status(503).json({ error: 'cofounder_access_unavailable' })
    }
  }
}

export function requireCofounderResource({ collection, param, statuses = null, permission = null } = {}) {
  return async (req, res, next) => {
    const resourceId = req.params[param]
    if (!resourceId) return res.status(400).json({ error: 'cofounder_resource_id_required' })
    try {
      const access = await runCofounderRead(req.user.id, {}, () => {
        const db = readAuthorityDb()
        const resource = rows(db, collection).find(row => String(row.id) === String(resourceId))
        if (!resource) return { ok: false, status: 404, error: 'cofounder_resource_not_found' }
        const relationshipId = resource.relationshipId
        if (!relationshipId) return { ok: false, status: 404, error: 'cofounder_resource_not_found' }
        const relationshipAccess = resolveCofounderRelationshipFromDb(db, req.user.id, relationshipId, { statuses, permission })
        if (relationshipAccess.ok === false) return { ok: false, status: 404, error: 'cofounder_resource_not_found' }
        return { ...relationshipAccess, resource }
      })
      if (access.ok === false) return sendAccessError(res, access)
      req.cofounderAccess = access
      req.cofounderResource = access.resource
      return next()
    } catch (error) {
      console.error(JSON.stringify({ event: 'cofounder_resource_access_failed', error: error.message }))
      return res.status(503).json({ error: 'cofounder_access_unavailable' })
    }
  }
}
