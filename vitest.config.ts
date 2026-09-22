import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate from vite.config.ts on purpose: that file's `rolldownOptions`
// (chunk splitting) is production-build-only concern, and keeping the test
// runner's config standalone means neither file has to account for the
// other's needs.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // No injected globals (describe/it/expect) — tests import them from
    // 'vitest' explicitly, matching the project's `verbatimModuleSyntax`
    // preference for explicit imports over ambient ones.
    globals: false,
  },
})
