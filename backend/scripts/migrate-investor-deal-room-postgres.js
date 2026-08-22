import fs from 'node:fs/promises'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const sql = await fs.readFile(new URL('../migrations/postgres/005_investor_deal_room.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
await client.connect()
try { await client.query(sql); console.log(JSON.stringify({ event: 'investor_deal_room_postgres_migrated' })) } finally { await client.end() }
