import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConversationSearch } from './useConversationSearch'
import { searchConversation } from '../services/api/messages'
import type { MessageSearchResultType } from '../utils/baseTypes'

vi.mock('../services/api/messages', () => ({
  CONVERSATION_SEARCH_LIMIT: 3,
  searchConversation: vi.fn(),
}))

const found = vi.mocked(searchConversation)

const match = (id: string): MessageSearchResultType => ({
  id,
  conversation_id: 'c1',
  conversation_title: 'Team',
  body: `redis ${id}`,
  sender: { id: 'u', name: 'Jordan' },
  created_at: '2026-09-24T10:02:00Z',
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

const open = () => renderHook(() => useConversationSearch('c1', true), { wrapper })

const type = (result: ReturnType<typeof open>['result'], text: string) =>
  act(() => result.current.setText(text))

beforeEach(() => {
  found.mockReset()
})

describe('useConversationSearch', () => {
  it('waits for two characters, then searches this conversation', async () => {
    found.mockResolvedValue({ results: [match('m3')], total: 1 })
    const { result } = open()

    type(result, 'r')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(found).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')

    type(result, 'redis')
    await waitFor(() => expect(result.current.status).toBe('found'))
    expect(found).toHaveBeenCalledWith('c1', 'redis')
    expect(result.current.terms).toEqual(['redis'])
  })

  it('starts at the newest match and steps back in time, within the matches it has', async () => {
    found.mockResolvedValue({ results: [match('m3'), match('m2'), match('m1')], total: 3 })
    const { result } = open()
    type(result, 'redis')
    await waitFor(() => expect(result.current.current?.id).toBe('m3'))

    expect(result.current.canGoNewer).toBe(false)
    act(() => result.current.older())
    act(() => result.current.older())
    expect(result.current.current?.id).toBe('m1')
    expect(result.current.index).toBe(2)
    expect(result.current.canGoOlder).toBe(false)

    act(() => result.current.older())
    expect(result.current.current?.id).toBe('m1')

    act(() => result.current.newer())
    expect(result.current.current?.id).toBe('m2')
  })

  it('says when there are more matches than came back', async () => {
    found.mockResolvedValue({ results: [match('m9'), match('m8'), match('m7')], total: 12 })
    const { result } = open()
    type(result, 'redis')

    await waitFor(() => expect(result.current.status).toBe('found'))
    expect(result.current.isTruncated).toBe(true)
    expect(result.current.total).toBe(12)
  })

  it('goes back to the newest match when the search changes', async () => {
    found.mockResolvedValueOnce({ results: [match('m3'), match('m2')], total: 2 })
    found.mockResolvedValueOnce({ results: [match('m5'), match('m4')], total: 2 })
    const { result } = open()
    type(result, 'redis')
    await waitFor(() => expect(result.current.status).toBe('found'))
    act(() => result.current.older())

    type(result, 'redis ttl')

    await waitFor(() => expect(result.current.current?.id).toBe('m5'))
    expect(result.current.index).toBe(0)
  })

  it('reports no matches, and a search that failed', async () => {
    found.mockResolvedValueOnce({ results: [], total: 0 })
    const { result } = open()
    type(result, 'nothing')
    await waitFor(() => expect(result.current.status).toBe('none'))
    expect(result.current.current).toBeNull()

    // Tried twice (one retry, a second apart) before it counts as failed.
    found.mockRejectedValue(new Error('Network Error'))
    type(result, 'broken')
    await waitFor(() => expect(result.current.status).toBe('failed'), { timeout: 3000 })
    expect(result.current.terms).toEqual([])
  })

  it('clears everything when reset', async () => {
    found.mockResolvedValue({ results: [match('m3')], total: 1 })
    const { result } = open()
    type(result, 'redis')
    await waitFor(() => expect(result.current.status).toBe('found'))

    act(() => result.current.reset())

    expect(result.current.text).toBe('')
    expect(result.current.status).toBe('idle')
    expect(result.current.terms).toEqual([])
  })
})
