import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPopupQueryClient,
  REVIEW_INBOX_STALE_TIME,
  useReviewInboxQuery,
} from '@/features/review-inbox/useReviewInboxQuery'

const messaging = vi.hoisted(() => ({
  createCorrelationId: vi.fn(() => 'inbox-query-1'),
  sendMessage: vi.fn(),
}))

vi.mock('@/shared/messaging/protocol', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/shared/messaging/protocol')>()
  return {
    ...original,
    createCorrelationId: messaging.createCorrelationId,
    sendMessage: messaging.sendMessage,
  }
})

const emptyData = {
  reviewRequests: { status: 'success' as const, items: [] },
  assigned: { status: 'success' as const, items: [] },
  recentActivity: { status: 'success' as const, items: [] },
}

const createWrapper = () => {
  const client = createPopupQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  )
}

describe('useReviewInboxQuery', () => {
  beforeEach(() => {
    messaging.sendMessage.mockResolvedValue({
      status: 'success',
      correlationId: 'inbox-query-1',
      data: emptyData,
    })
  })

  it('configures an ephemeral popup query cache', () => {
    const options = createPopupQueryClient().getDefaultOptions().queries

    expect(options?.staleTime).toBe(REVIEW_INBOX_STALE_TIME)
    expect(options?.refetchOnWindowFocus).toBe(false)
    expect(options?.retry).toBe(false)
  })

  it('loads inbox data once under StrictMode and supports refetch', async () => {
    const { result } = renderHook(() => useReviewInboxQuery(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(emptyData)
    expect(messaging.sendMessage).toHaveBeenCalledTimes(1)
    expect(messaging.sendMessage).toHaveBeenCalledWith('getReviewInbox', {
      correlationId: 'inbox-query-1',
    })

    await result.current.refetch()
    expect(messaging.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('maps a missing receiver to a stable query error', async () => {
    messaging.sendMessage.mockRejectedValue(
      new Error(
        'Could not establish connection. Receiving end does not exist.',
      ),
    )
    const { result } = renderHook(() => useReviewInboxQuery(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({
      code: 'receiver-unavailable',
    })
  })
})
