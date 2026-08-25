export function requireRole(...roles) {
  const allowed = new Set(roles.flat().filter(Boolean))
  return (req, res, next) => {
    const userRoles = new Set([req.user?.role, ...(req.user?.roles || [])])
    if (!allowed.size || [...allowed].some(role => userRoles.has(role))) return next()
    return res.status(403).json({ error: 'Role not permitted' })
  }
}

export function requireAdmin(req, res, next) {
  const role = req.user?.role
  if (role === 'admin' || role === 'super_admin') return next()
  return res.status(403).json({ error: 'Admin access required' })
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role === 'super_admin') return next()
  return res.status(403).json({ error: 'Super admin access required' })
}

export function requireSupportPermission(permission) {
  return (req, res, next) => {
    const permissions = new Set(req.user?.permissions || [])
    if (req.user?.role === 'super_admin' || permissions.has('all') || permissions.has(permission)) return next()
    return res.status(403).json({ error: 'Support permission required', permission })
  }
}
