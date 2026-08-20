import { vi } from 'vitest'

export interface BrowserStorageMock {
  get: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

export const createBrowserStorageMock = (): BrowserStorageMock => {
  return {
    get: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  }
}
