import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // tsconfig keeps jsx: "preserve" for Next, so the transform needs telling how
  // to compile JSX here — without it any test that renders a component (the
  // email templates) fails to parse.
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    globals: true,
    environment: 'node',
    // e2e/ is Playwright's (see playwright.config.ts testDir). Vitest used to
    // pick those specs up and report them as failed suites, so a green run
    // looked like a failing one and a real failure was easy to miss.
    exclude: ['**/node_modules/**', '**/dist/**', '.next/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
