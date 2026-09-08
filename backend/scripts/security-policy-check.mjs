import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const required = [
  '../docs/SECURITY_ARCHITECTURE_MAP.md',
  '../docs/THREAT_MODEL.md',
  '../docs/ROLE_PERMISSION_MATRIX.md',
  '../docs/API_SECURITY_MATRIX.md',
  '../docs/AI_SECURITY_MODEL.md',
  '../docs/MCP_SECURITY_MODEL.md',
  '../docs/DATA_CLASSIFICATION.md',
  '../docs/INCIDENT_RESPONSE.md',
  '../docs/SECURITY_TEST_PLAN.md',
  '../docs/SECURITY_RUNBOOK.md',
  '../docs/SECURITY_CHANGE_PROTOCOL.md',
  '../docs/OWASP_CONTROL_MAPPING.md',
  '../docs/SECURITY_POSTURE_SCORE.md',
]

const missing = required.filter(file => !fs.existsSync(path.resolve(root, file)))
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
const forbidden = []
const patterns = [
  { name: 'private-key-material', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'provider-secret', re: /\b(?:sk|rk|xox[baprs])-[A-Za-z0-9_-]{20,}\b/ },
]
for (const file of tracked) {
  if (/node_modules|dist\/|coverage\/|\.lock$|\.map$/.test(file)) continue
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  for (const pattern of patterns) if (pattern.re.test(text)) forbidden.push({ file, finding: pattern.name })
}
if (missing.length || forbidden.length) {
  console.error(JSON.stringify({ ok: false, missing, forbidden }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, requiredDocuments: required.length, scannedFiles: tracked.length }))
