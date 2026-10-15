// Read-only identity-schema probe used by the "TECHIT Box - Triage" workflow.
//
// Extracted from an inline shell heredoc: a heredoc body must start at column 1
// for bash, but column-1 content terminates a YAML block scalar, which made the
// workflow file unparseable and every run fail with no jobs. Run from the repo
// root (`cd "$HOME/BACKEND" && node ops/ec2/box-triage-schema-probe.mjs`).
import fs from 'node:fs'
import pg from 'pg'

const env = fs.readFileSync('backend/.env', 'utf8')
const m = env.match(/^DATABASE_URL=(.*)$/m)
const url = m ? m[1].replace(/^"|"$/g, '') : ''
if (!url) {
  console.log('no DATABASE_URL')
  process.exit(0)
}
const c = new pg.Client({
  connectionString: url,
  ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
})
try {
  await c.connect()
  const t = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'core\\_%' ORDER BY table_name",
  )
  console.log('core_* tables:', t.rows.map((r) => r.table_name).join(', ') || '(none)')
  for (const n of ['core_users', 'core_profiles', 'core_user_roles', 'core_active_contexts']) {
    try {
      const r = await c.query('SELECT count(*)::int AS n FROM ' + n)
      console.log(n, 'rows=', r.rows[0].n)
    } catch (e) {
      console.log(n, 'ERROR:', e.message)
    }
  }
  const e2 = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%user%' ORDER BY table_name",
  )
  console.log('user-ish tables:', e2.rows.map((r) => r.table_name).join(', ') || '(none)')
} catch (e) {
  console.log('connect_error:', e.message)
} finally {
  await c.end().catch(() => {})
}
