import { rollbackDrillStatus } from '../src/services/postgresCutoverMonitor.js'

const status = rollbackDrillStatus()
console.log(JSON.stringify({ event: 'postgres_cutover_rollback_drill', ...status }))
if (!status.ok) process.exitCode = 1
