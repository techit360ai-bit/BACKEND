export const ALLOWED_ROLES = new Set(['explorer', 'user', 'founder', 'collaborator', 'investor', 'organisation', 'organization'])

export const ADMIN_ROLES = new Set(['admin', 'super_admin'])

export const ALL_ROLES = new Set(['founder', 'collaborator', 'investor', 'organisation', 'admin', 'super_admin'])

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email
}

export function isAllowedRole(role) {
  return typeof role === 'string' && ALLOWED_ROLES.has(role.toLowerCase())
}

export function isAdminRole(role) {
  return typeof role === 'string' && ADMIN_ROLES.has(role)
}
