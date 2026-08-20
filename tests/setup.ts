import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const isDebugLoggingEnabled = process.env.LOG_LEVEL?.toLowerCase() === 'debug'

afterEach(() => {
  cleanup()

  if (isDebugLoggingEnabled) {
    console.debug('[tests.setup] Test DOM cleaned up')
  }
})
