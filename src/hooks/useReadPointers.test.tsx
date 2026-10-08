import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import useReadPointers from './useReadPointers'
import { getReadPointers } from '../services/api/conversations'
import { readPointersKey } from '../utils/readReceipts'

vi.mock('../services/api/conversations', () => ({ getReadPointers: vi.fn() }))

const httpError = (status: number) => {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', String(status), config, null, { status, statusText: '', headers: {}, config, data: {} })
}

let client: QueryClient

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

const failedRequests = async (error: Error) => {
  vi.mocked(getReadPointers).mockRejectedValue(error)
  renderHook(() => useReadPointers('c1', true), { wrapper })
  await waitFor(() => expect(client.getQueryState(readPointersKey('c1'))?.status).toBe('error'))
  return vi.mocked(getReadPointers).mock.calls.length
}

describe('useReadPointers', () => {
  beforeEach(() => {
    vi.mocked(getReadPointers).mockReset()
    // The app's own default (see main.tsx) is to retry once; no delay here.
    client = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 0 } } })
  })

  // A link into a conversation the viewer isn't in, or one they've left.
  it.each([403, 404])('takes a %i as the answer, without asking again', async (status) => {
    expect(await failedRequests(httpError(status))).toBe(1)
  })

  it('asks once more when the request just failed', async () => {
    expect(await failedRequests(httpError(500))).toBe(2)
  })
})
