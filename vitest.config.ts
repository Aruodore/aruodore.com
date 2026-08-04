import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '~': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/{unit,component,integration}/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['composables/**/*.ts', 'pieces/**/box-muller.ts', 'pieces/**/model.ts', 'utils/**/*.ts'],
      exclude: ['tests/**'],
      thresholds: { lines: 90, statements: 90, functions: 85, branches: 80 },
    },
  },
})
