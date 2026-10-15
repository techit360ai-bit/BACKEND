// Read-only RDS connection report, seen through the in-box PgBouncer proxy.
// Used by the "Ops - PgBouncer" workflow in `status` mode.
//
// Extracted from an inline shell heredoc: a heredoc body must start at column 1
// for bash, but column-1 content terminates a YAML block scalar, which made the
// workflow file unparseable and every run fail with no jobs. Run from the repo
// root (`cd "$HOME/BACKEND" && node ops/ec2/pgbouncer-pool-report.mjs`).
import fs from 'node:fs'
import pg from 'pg'

const url = fs.readFileSync(process.env.HOME + '/.techit/platform-database-url', 'utf8').trim()
const u = new URL(url)
u.hostname = '127.0.0.1'
u.port = '6432'
u.searchParams.set('sslmode', 'disable')
const c = new pg.Client({ connectionString: u.toString() })
try {
  await c.connect()
  const max = await c.query('show max_connections')
  const tot = await c.query('select count(*)::int n from pg_stat_activity where datname is not null')
  const by = await c.query(
    "select coalesce(application_name,'') app, coalesce(state,'?') state, count(*)::int n from pg_stat_activity where datname is not null group by 1,2 order by n desc limit 30",
  )
  console.log('max_connections=' + max.rows[0].max_connections + ' db_connections=' + tot.rows[0].n)
  for (const r of by.rows) console.log(r.n + ' | ' + (r.app || '(none)') + ' | ' + r.state)
} catch (error) {
  console.log('connection probe error: ' + error.message)
} finally {
  await c.end().catch(() => {})
}
