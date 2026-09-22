// Runs before every test file (see vitest.config.ts's `setupFiles`).
// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, …).
import '@testing-library/jest-dom/vitest'

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library's own auto-cleanup only self-registers when it finds a
// Jest-style global `afterEach` — this project runs Vitest with
// `globals: false` (see vitest.config.ts), so without this each test's
// rendered DOM would leak into the next one in the same file.
afterEach(() => {
  cleanup()
})
