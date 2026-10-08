import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEFAULT_SETTINGS, settingsKey, useUpdateSettings } from './useSettings'
import { updateSettings } from '../services/api/settings'
import { messageInfoKey, readPointersKey } from '../utils/readReceipts'

vi.mock('../services/api/settings', () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

const setUp = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(settingsKey, DEFAULT_SETTINGS)
  client.setQueryData(readPointersKey('c1'), [])
  client.setQueryData([...messageInfoKey('c1'), 'm1'], { read_by: [], not_read: [] })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useUpdateSettings(), { wrapper })

  return { client, update: result.current }
}

beforeEach(() => {
  vi.mocked(updateSettings).mockReset()
  vi.mocked(updateSettings).mockImplementation(async (changes) => ({ ...DEFAULT_SETTINGS, ...changes }))
})

describe('useUpdateSettings', () => {
  // The server has just noted where everyone's pointer stands, so what the
  // viewer may see of anyone's reading has changed.
  it('asks for read state again when read receipts are switched', async () => {
    const { client, update } = setUp()

    act(() => update({ read_receipts: false }))

    await waitFor(() => expect(client.getQueryState(readPointersKey('c1'))?.isInvalidated).toBe(true))
    expect(client.getQueryState([...messageInfoKey('c1'), 'm1'])?.isInvalidated).toBe(true)
  })

  it('leaves read state alone when another setting changes', async () => {
    const { client, update } = setUp()

    act(() => update({ typing_indicators: false }))

    await waitFor(() => expect(client.getQueryData(settingsKey)).toMatchObject({ typing_indicators: false }))
    expect(updateSettings).toHaveBeenCalledWith({ typing_indicators: false })
    expect(client.getQueryState(readPointersKey('c1'))?.isInvalidated).toBe(false)
    expect(client.getQueryState([...messageInfoKey('c1'), 'm1'])?.isInvalidated).toBe(false)
  })
})
