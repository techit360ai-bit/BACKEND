import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.js'],
    env: {
      JWT_SECRET: 'test_jwt_secret_do_not_use_in_production',
      BCRYPT_ROUNDS: '2',
      // Isolate the Plugins-MCP file-store away from backend/data/plugins-mcp.json
      // so the suite never reads or writes the production-like fixture.
      MCP_DATA_FILE: '/tmp/vitest-mcp-store.json',
    },
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**', 'src/index.js'],
    },
  },
})
