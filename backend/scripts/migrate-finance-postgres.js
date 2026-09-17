import { closeFinancePostgresProjection, initializeFinancePostgresProjection } from '../src/services/financePostgresProjection.js'
if (!process.env.FINANCE_DATABASE_URL && !process.env.DATABASE_URL) throw new Error('FINANCE_DATABASE_URL or DATABASE_URL is required')
try { console.log(JSON.stringify({ event: 'finance_postgres_migrated', ...(await initializeFinancePostgresProjection()) })) } finally { await closeFinancePostgresProjection() }
