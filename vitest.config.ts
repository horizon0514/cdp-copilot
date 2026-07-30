import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts so the CRX plugin is not loaded for
// unit tests, and so Vitest does not try to run the Playwright specs in e2e/
// (those are *.spec.ts and belong to the Playwright runner).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'dist/**', 'node_modules/**'],
    setupFiles: ['src/test/setup.ts'],
  },
});

