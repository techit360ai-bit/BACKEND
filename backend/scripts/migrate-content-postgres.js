import { closeContentPostgresProjection, initializeContentPostgresProjection } from '../src/services/contentPostgresProjection.js'
if (!process.env.CONTENT_DATABASE_URL && !process.env.DATABASE_URL) throw new Error('CONTENT_DATABASE_URL or DATABASE_URL is required')
try { console.log(JSON.stringify({ event: 'content_postgres_migrated', ...(await initializeContentPostgresProjection()) })) } finally { await closeContentPostgresProjection() }
