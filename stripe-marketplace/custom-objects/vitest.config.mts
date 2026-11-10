import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['@stripe/extensibility-test-helpers/vitest'],
  },
});
