import fs from 'node:fs/promises'
import pg from 'pg'
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const baseSql = await fs.readFile(new URL('../migrations/postgres/006_organization_intelligence_operations.sql', import.meta.url), 'utf8')
const commercialSql = await fs.readFile(new URL('../migrations/postgres/017_organization_commercialization.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
await client.connect()
try { await client.query(`${baseSql}\n${commercialSql}`); console.log(JSON.stringify({ event: 'organization_intelligence_postgres_migrated', commercial: true })) } finally { await client.end() }
