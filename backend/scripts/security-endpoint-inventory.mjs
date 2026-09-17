import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const output = process.env.SECURITY_ENDPOINT_INVENTORY_FILE || '/tmp/techit-security-endpoint-inventory.json'
const rows = []
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(full)
    else if (entry.name.endsWith('.js')) {
      const source = await fs.readFile(full, 'utf8')
      const relative = path.relative(root, full)
      for (const match of source.matchAll(/\b(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi)) {
        const authentication = /requireAuth|requireAdminAuth|serviceAuth|verifyService/i.test(source) ? 'enforced' : 'missing-or-route-specific'
        const authorization = /authorizeCapability|requireCapability|requireRole|resourceScope|ownership/i.test(source) ? 'enforced' : 'review-required'
        const validation = /body\(|query\(|params\.|zod|schema|validate/i.test(source) ? 'present' : 'review-required'
        const rateLimit = /globalRateLimit|rateLimit|throttle/i.test(source) ? 'present' : 'review-required'
        const audit = /audit|recordSecurity|recordActivity|securityEvent/i.test(source) ? 'present' : 'review-required'
        rows.push({ method: match[1].toUpperCase(), path: match[2], file: relative, authentication, authorization, validation, rateLimit, audit, reviewRequired: [authentication, authorization, validation, rateLimit, audit].includes('review-required') })
      }
    }
  }
}
await walk(root)
rows.sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`))
await fs.writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, endpoints: rows }, null, 2))
console.log(JSON.stringify({ event: 'security_endpoint_inventory_ready', output, count: rows.length }))
