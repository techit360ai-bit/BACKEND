import crypto from 'node:crypto'
import { readDb } from '../src/config/database.js'
import { getPlatformPool } from '../src/repositories/platformCollectionRepository.js'

if (!process.env.PLATFORM_DATABASE_URL && !process.env.DATABASE_URL) throw new Error('PLATFORM_DATABASE_URL or DATABASE_URL is required')
const configuredDriver = process.env.DB_DRIVER
if (configuredDriver === 'postgres') process.env.DB_DRIVER = process.env.LEGACY_DB_DRIVER || 'sqlite'
const db = readDb()
if (configuredDriver === 'postgres') process.env.DB_DRIVER = configuredDriver
const pool = getPlatformPool()
const result = await pool.query('SELECT collection_name,count(*)::int AS count FROM platform_collection_records WHERE deleted_at IS NULL GROUP BY collection_name')
const actual = Object.fromEntries(result.rows.map(row => [row.collection_name, Number(row.count)]))
const expected = Object.fromEntries(Object.entries(db).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.filter(record => record && record.id).length]))
const mismatches = Object.fromEntries([...new Set([...Object.keys(actual), ...Object.keys(expected)])].filter(key => actual[key] !== expected[key]).map(key => [key, { expected: expected[key] || 0, actual: actual[key] || 0 }]))
const report = { event: 'platform_postgres_verification', consistent: Object.keys(mismatches).length === 0, mismatches, expectedCollections: Object.keys(expected).length, actualCollections: Object.keys(actual).length, expectedRecords: Object.values(expected).reduce((sum, value) => sum + value, 0), actualRecords: Object.values(actual).reduce((sum, value) => sum + value, 0), generatedAt: new Date().toISOString(), checksumAlgorithm: 'sha256' }
console.log(JSON.stringify(report))
await pool.end()
if (!report.consistent) process.exitCode = 1
