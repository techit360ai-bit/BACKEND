import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@techit/core': r('./packages/core/src/index.ts'),
      '@techit/plugin-sdk': r('./packages/plugin-sdk/src/index.ts'),
      '@techit/mcp-client': r('./packages/mcp-client/src/index.ts'),
      '@techit/infra-secrets': r('./infra/secrets/src/index.ts'),
      '@techit/infra-audit': r('./infra/audit/src/index.ts'),
      '@techit/infra-auth': r('./infra/auth/src/index.ts'),
      '@techit/plugin-github': r('./plugins/github/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
