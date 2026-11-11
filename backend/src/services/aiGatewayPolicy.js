const DEFAULT_PREFIXES = ['incubation', 'trust', 'workspace', 'tour-guide', 'dashboard', 'training', 'investor', 'gsis', 'models']
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])
const UNSAFE_PATH = /(\.\.|\\|\/\/|%2f|%5c|%2e|%00|[\u0000-\u001f])/i

export function gatewayPrefixes(env = process.env) {
  const raw = String(env.AI_GATEWAY_ALLOWED_PREFIXES || '').trim()
  const list = raw ? raw.split(',') : DEFAULT_PREFIXES
  return new Set(list.map(item => item.trim().toLowerCase()).filter(item => /^[a-z0-9-]+$/.test(item)))
}

export function resolveGatewayTarget(method, url, env = process.env) {
  if (!METHODS.has(String(method).toUpperCase())) return { ok: false, status: 405, error: 'method_not_allowed' }
  const raw = String(url || '')
  const cut = raw.indexOf('?')
  const path = cut === -1 ? raw : raw.slice(0, cut)
  const query = cut === -1 ? '' : raw.slice(cut + 1)
  if (!path.startsWith('/') || UNSAFE_PATH.test(path)) return { ok: false, status: 400, error: 'invalid_path' }
  if (!gatewayPrefixes(env).has(path.split('/')[1].toLowerCase())) return { ok: false, status: 404, error: 'not_found' }
  return { ok: true, path: `/api/v1${path}`, query }
}
