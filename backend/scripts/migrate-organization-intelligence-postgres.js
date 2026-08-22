import fs from 'node:fs/promises'
import pg from 'pg'
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const sql = await fs.readFile(new URL('../migrations/postgres/006_organization_intelligence_operations.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
await client.connect()
try { await client.query(sql); console.log(JSON.stringify({ event: 'organization_intelligence_postgres_migrated' })) } finally { await client.end() }
