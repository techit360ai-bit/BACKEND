import fs from 'node:fs/promises'
import pg from 'pg'

const url = process.env.TRUST_DATABASE_URL || process.env.DATABASE_URL
if (!url) throw new Error('TRUST_DATABASE_URL or DATABASE_URL is required')
const sql = await fs.readFile(new URL('../migrations/postgres/002_trust_capability_authorization.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.TRUST_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
await client.connect()
try { await client.query(sql); console.log(JSON.stringify({ event: 'trust_postgres_migrated' })) } finally { await client.end() }
