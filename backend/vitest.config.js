import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.js'],
    env: {
      JWT_SECRET: 'test_jwt_secret_do_not_use_in_production',
      BCRYPT_ROUNDS: '2',
    },
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**', 'src/index.js'],
    },
  },
})
