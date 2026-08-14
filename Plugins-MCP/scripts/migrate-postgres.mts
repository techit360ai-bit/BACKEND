import { createMcpPool, migrateMcpDatabase } from '../server/postgres-store.js';

const pool = createMcpPool();
try {
  await migrateMcpDatabase(pool);
  console.log('MCP PostgreSQL migration complete');
} finally {
  await pool.end();
}
