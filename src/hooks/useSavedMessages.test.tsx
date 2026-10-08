import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { savedIdsKey, useSavedMessageIds, useToggleSaved } from './useSavedMessages'
import { getSavedMessageIds, saveMessage, unsaveMessage } from '../services/api/savedMessages'

vi.mock('../services/api/savedMessages', () => ({
  getSavedMessageIds: vi.fn(),
  getSavedMessages: vi.fn(),
  saveMessage: vi.fn(),
  unsaveMessage: vi.fn(),
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

let client: QueryClient

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

/** A promise the test settles when it's ready to. */
function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.mocked(getSavedMessageIds).mockReset()
  vi.mocked(saveMessage).mockReset()
  vi.mocked(unsaveMessage).mockReset()
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})

describe('useSavedMessageIds', () => {
  it('asks once, and answers whether a message is saved', async () => {
    vi.mocked(getSavedMessageIds).mockResolvedValue(['m1', 'm2'])
    const { result, rerender } = renderHook(() => useSavedMessageIds(), { wrapper })

    expect(result.current.has('m1')).toBe(false)
    await waitFor(() => expect(result.current.has('m1')).toBe(true))
    expect(result.current.has('m3')).toBe(false)

    rerender()
    renderHook(() => useSavedMessageIds(), { wrapper })
    expect(getSavedMessageIds).toHaveBeenCalledTimes(1)
  })
})

describe('useToggleSaved', () => {
  it('marks a message saved at once, and unmarks it if the server says no', async () => {
    client.setQueryData(savedIdsKey, ['m1'])
    const request = deferred()
    vi.mocked(saveMessage).mockReturnValue(request.promise)
    const { result } = renderHook(() => ({ ids: useSavedMessageIds(), toggle: useToggleSaved() }), { wrapper })

    act(() => result.current.toggle('m2', true))

    await waitFor(() => expect(result.current.ids.has('m2')).toBe(true))
    await act(async () => request.reject(new Error('offline')))
    await waitFor(() => expect(result.current.ids.has('m2')).toBe(false))
    expect(result.current.ids.has('m1')).toBe(true)
  })

  it('unmarks a message at once, and keeps it that way once the server agrees', async () => {
    client.setQueryData(savedIdsKey, ['m1', 'm2'])
    vi.mocked(unsaveMessage).mockResolvedValue(undefined)
    const { result } = renderHook(() => ({ ids: useSavedMessageIds(), toggle: useToggleSaved() }), { wrapper })

    act(() => result.current.toggle('m1', false))

    await waitFor(() => expect(unsaveMessage).toHaveBeenCalledWith('m1'))
    expect([...result.current.ids]).toEqual(['m2'])
  })

  // Made up here, a partial list would pass for the real one, and with no
  // reason to go stale, never be asked for.
  it('doesn’t write down saved ids it was never given', async () => {
    vi.mocked(saveMessage).mockResolvedValue(undefined)
    const { result } = renderHook(() => useToggleSaved(), { wrapper })

    act(() => result.current('m2', true))

    await waitFor(() => expect(saveMessage).toHaveBeenCalledWith('m2'))
    expect(client.getQueryData(savedIdsKey)).toBeUndefined()
  })
})
