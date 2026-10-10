import fs from 'node:fs/promises'
import pg from 'pg'

const url = process.env.TRUST_DATABASE_URL || process.env.DATABASE_URL
if (!url) throw new Error('TRUST_DATABASE_URL or DATABASE_URL is required')
const trustSql = await fs.readFile(new URL('../migrations/postgres/002_trust_capability_authorization.sql', import.meta.url), 'utf8')
const explorerSql = await fs.readFile(new URL('../migrations/postgres/004_explorer_multirole.sql', import.meta.url), 'utf8')
const proofSql = await fs.readFile(new URL('../migrations/postgres/018_trust_proof_authority.sql', import.meta.url), 'utf8')
const normalizedSql = await fs.readFile(new URL('../migrations/postgres/019_trust_authority_normalized.sql', import.meta.url), 'utf8')
const identitySql = await fs.readFile(new URL('../migrations/postgres/020_trust_identity_screening.sql', import.meta.url), 'utf8')
const overrideSql = await fs.readFile(new URL('../migrations/postgres/021_trust_score_overrides.sql', import.meta.url), 'utf8')
const sql = `${trustSql}\n${explorerSql}\n${proofSql}\n${normalizedSql}\n${identitySql}\n${overrideSql}`
const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.TRUST_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
await client.connect()
try { await client.query(sql); console.log(JSON.stringify({ event: 'trust_postgres_migrated' })) } finally { await client.end() }
