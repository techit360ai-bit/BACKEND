import { closeDbForTests, migrateSqlite, rollbackLatestSqliteMigration } from '../src/config/database.js'

const command = process.argv[2] || 'up'
const dbPath = process.env.SQLITE_DB_PATH
const dryRun = process.argv.includes('--dry-run')

try {
  if (command === 'up') {
    migrateSqlite({ dbPath, dryRun })
    console.log(`SQLite migrations ${dryRun ? 'dry-run ' : ''}applied successfully`)
  } else if (command === 'down') {
    const rolledBack = rollbackLatestSqliteMigration({ dbPath, dryRun })
    if (rolledBack) {
      console.log(`SQLite migration ${rolledBack.version} ${dryRun ? 'dry-run ' : ''}rolled back successfully`)
    } else {
      console.log('No SQLite migrations to roll back')
    }
  } else {
    throw new Error(`Unknown migration command "${command}". Use "up" or "down".`)
  }
} finally {
  closeDbForTests()
}
