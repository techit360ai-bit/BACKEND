export function requireRole(...roles) {
  const allowed = new Set(roles.flat().filter(Boolean))
  return (req, res, next) => {
    if (!allowed.size || allowed.has(req.user?.role)) return next()
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
