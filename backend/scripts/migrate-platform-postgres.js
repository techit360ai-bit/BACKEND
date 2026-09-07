import fs from 'node:fs/promises'
import pg from 'pg'

const url = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL
if (!url) throw new Error('PLATFORM_DATABASE_URL or DATABASE_URL is required')
const sql = await fs.readFile(new URL('../migrations/postgres/014_platform_collection_records.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.PLATFORM_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
await client.connect()
try { await client.query(sql); console.log(JSON.stringify({ event: 'platform_postgres_schema_ready' })) } finally { await client.end() }
