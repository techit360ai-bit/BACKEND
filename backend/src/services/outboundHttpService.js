import dns from 'node:dns/promises'
import net from 'node:net'

const blockedHosts = new Set(['localhost', 'metadata.google.internal', '169.254.169.254', 'metadata.internal'])
const privateV4 = ip => { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) }
const privateV6 = ip => ip === '::1' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd') || ip.toLowerCase().startsWith('fe80:')

export async function assertPublicUrl(value, { schemes = ['https'], allowHosts = [] } = {}) {
  let url
  try { url = new URL(String(value)) } catch { throw new Error('outbound_url_invalid') }
  if (!schemes.includes(url.protocol.slice(0, -1))) throw new Error('outbound_scheme_blocked')
  const host = url.hostname.toLowerCase()
  if (blockedHosts.has(host) || host.endsWith('.localhost') || host.endsWith('.internal')) throw new Error('outbound_host_blocked')
  if (allowHosts.length && !allowHosts.includes(host)) throw new Error('outbound_host_not_allowed')
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map(row => row.address)
  if (!addresses.length || addresses.some(ip => net.isIPv4(ip) ? privateV4(ip) : privateV6(ip))) throw new Error('outbound_private_address_blocked')
  return url
}

export async function safeFetch(url, init = {}, options = {}) {
  let current = String(url)
  const maxRedirects = Math.max(0, Math.min(5, Number(options.maxRedirects ?? 3)))
  for (let attempt = 0; attempt <= maxRedirects; attempt += 1) {
    await assertPublicUrl(current, options)
    const response = await fetch(current, { ...init, redirect: 'manual' })
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    if (!location || attempt === maxRedirects) throw new Error('outbound_redirect_blocked')
    current = new URL(location, current).toString()
  }
  throw new Error('outbound_redirect_blocked')
}
