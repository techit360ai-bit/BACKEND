export function requireRole(...roles) {
  const allowed = new Set(roles.flat().filter(Boolean))
  return (req, res, next) => {
    if (!allowed.size || allowed.has(req.user?.role)) return next()
    return res.status(403).json({ error: 'Role not permitted' })
  }
}
