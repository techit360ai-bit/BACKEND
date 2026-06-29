export const ALLOWED_ROLES = new Set(['founder', 'collaborator', 'investor', 'organisation'])

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email
}

export function isAllowedRole(role) {
  return typeof role === 'string' && ALLOWED_ROLES.has(role)
}
