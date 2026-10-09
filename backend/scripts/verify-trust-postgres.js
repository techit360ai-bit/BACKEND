import { readDb } from '../src/config/database.js'
import pg from 'pg'

const url = process.env.TRUST_DATABASE_URL || process.env.DATABASE_URL
if (!url) throw new Error('TRUST_DATABASE_URL or DATABASE_URL is required')

// Read the legacy authority from its own driver so the comparison is
// like-for-like even when the platform is configured for Postgres.
const configuredDriver = process.env.DB_DRIVER
if (configuredDriver === 'postgres') process.env.DB_DRIVER = process.env.LEGACY_DB_DRIVER || 'sqlite'
const legacy = readDb()
if (configuredDriver === 'postgres') process.env.DB_DRIVER = configuredDriver

const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.TRUST_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
await client.connect()
try {
  const proofCount = Number((await client.query('SELECT count(*)::int AS count FROM trust_verification_proofs')).rows[0].count)
  const skillCount = Number((await client.query('SELECT count(*)::int AS count FROM trust_verified_skills')).rows[0].count)
  const legacyProofs = (legacy.trustVerificationProofs || []).filter(row => row && row.id).length
  const legacySkills = (legacy.verifiedSkills || []).filter(row => row && row.id).length
  const report = {
    event: 'trust_postgres_verification',
    consistent: proofCount >= legacyProofs && skillCount >= legacySkills,
    proofs: { legacy: legacyProofs, postgres: proofCount },
    skills: { legacy: legacySkills, postgres: skillCount },
    note: 'Postgres must be a superset of legacy after backfill; extra rows are expected once the repository is the writer.',
    generatedAt: new Date().toISOString(),
  }
  console.log(JSON.stringify(report))
  if (!report.consistent) process.exitCode = 1
} finally {
  await client.end()
}
