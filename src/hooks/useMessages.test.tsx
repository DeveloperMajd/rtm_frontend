import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useMessages from './useMessages'
import { getMessagesPage, type MessagesPageParam } from '../services/api/messages'
import type { MessageType } from '../utils/baseTypes'
import type { MessagesPage } from '../utils/messagePages'

// A stand-in for the conversation's Echo channel: the test plays the
// server's broadcasts through `broadcast`.
const echo = vi.hoisted(() => {
  const handlers: Record<string, (payload: unknown) => void> = {}
  const channel = {
    listen: (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = handler
      return channel
    },
    stopListening: () => channel,
  }
  return {
    handlers,
    instance: { private: () => channel, leave: () => {} },
  }
})

vi.mock('./useEcho', () => ({ default: () => echo.instance }))
vi.mock('../services/api/messages', () => ({ getMessagesPage: vi.fn() }))
vi.mock('../services/api/conversations', () => ({ markConversationAsRead: vi.fn(() => Promise.resolve()) }))

const fetchPage = vi.mocked(getMessagesPage)

const msg = (id: string): MessageType => ({
  id,
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'other', name: 'Jordan' },
  body: id,
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
})

/** Plays a broadcast, then lets React Query deliver the cache change (it
 * notifies observers on a timeout, not synchronously). */
const broadcast = async (event: string, payload: unknown) => {
  await act(async () => {
    echo.handlers[event]?.(payload)
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

/** Serves one conversation of m1…m9, with `newest` as its newest message. */
function serve(pages: Partial<Record<MessagesPageParam['kind'], MessagesPage>>) {
  fetchPage.mockImplementation(async (_conversationId, param) => {
    const page = pages[param.kind]
    if (!page) throw new Error(`unexpected ${param.kind} read`)
    return page
  })
}

const ids = (messages: MessageType[]) => messages.map((m) => m.id)

beforeEach(() => {
  fetchPage.mockReset()
  for (const event of Object.keys(echo.handlers)) delete echo.handlers[event]
})

describe('useMessages — a window opened around a jump', () => {
  it('opens around the message, then reads forwards until it reaches the newest', async () => {
    serve({
      around: { data: [msg('m4'), msg('m5'), msg('m6')], meta: { has_more: true, next_before_id: 'm4', next_after_id: 'm6' } },
      newer: { data: [msg('m7'), msg('m8')], meta: { has_more: true, next_before_id: 'm7', next_after_id: null } },
    })

    const { result } = renderHook(() => useMessages('c1', false, { anchor: 'm5' }), { wrapper })

    await waitFor(() => expect(ids(result.current.messages)).toEqual(['m4', 'm5', 'm6']))
    expect(fetchPage).toHaveBeenCalledWith('c1', { kind: 'around', id: 'm5' })
    expect(result.current.hasNewer).toBe(true)
    expect(result.current.hasMore).toBe(true)

    act(() => result.current.loadNewer())

    await waitFor(() => expect(ids(result.current.messages)).toEqual(['m4', 'm5', 'm6', 'm7', 'm8']))
    expect(fetchPage).toHaveBeenCalledWith('c1', { kind: 'newer', after: 'm6' })
    expect(result.current.hasNewer).toBe(false)
  })

  it('still reads older history from the top of the window', async () => {
    serve({
      around: { data: [msg('m4'), msg('m5')], meta: { has_more: true, next_before_id: 'm4', next_after_id: null } },
      older: { data: [msg('m2'), msg('m3')], meta: { has_more: false, next_before_id: null } },
    })

    const { result } = renderHook(() => useMessages('c1', false, { anchor: 'm5' }), { wrapper })
    await waitFor(() => expect(result.current.hasMore).toBe(true))

    act(() => result.current.loadOlder())

    await waitFor(() => expect(ids(result.current.messages)).toEqual(['m2', 'm3', 'm4', 'm5']))
    expect(fetchPage).toHaveBeenCalledWith('c1', { kind: 'older', before: 'm4' })
  })

  // Shown straight away it would sit under m6 with m7 and m8 missing between
  // them; dropped, it would be lost if it was committed just after the read
  // that catches the window up had been answered.
  it('holds a live message until the window has caught up, then shows it', async () => {
    serve({
      around: { data: [msg('m5'), msg('m6')], meta: { has_more: false, next_before_id: null, next_after_id: 'm6' } },
      newer: { data: [msg('m7'), msg('m8')], meta: { has_more: true, next_before_id: 'm7', next_after_id: null } },
    })

    const { result } = renderHook(() => useMessages('c1', false, { anchor: 'm5', deferUntilReady: false }), { wrapper })
    await waitFor(() => expect(result.current.hasNewer).toBe(true))

    await broadcast('MessageSent', msg('m9'))
    expect(ids(result.current.messages)).toEqual(['m5', 'm6'])

    act(() => result.current.loadNewer())

    await waitFor(() => expect(ids(result.current.messages)).toEqual(['m5', 'm6', 'm7', 'm8', 'm9']))
  })

  it('keeps a held message up to date with edits made before it is shown', async () => {
    serve({
      around: { data: [msg('m5')], meta: { has_more: false, next_before_id: null, next_after_id: 'm5' } },
      newer: { data: [msg('m6')], meta: { has_more: true, next_before_id: 'm6', next_after_id: null } },
    })

    const { result } = renderHook(() => useMessages('c1', false, { anchor: 'm5' }), { wrapper })
    await waitFor(() => expect(result.current.hasNewer).toBe(true))

    await broadcast('MessageSent', msg('m9'))
    await broadcast('MessageUpdated', { ...msg('m9'), body: 'edited' })
    act(() => result.current.loadNewer())

    await waitFor(() => expect(result.current.messages.at(-1)).toMatchObject({ id: 'm9', body: 'edited' }))
  })
})

describe('useMessages — the newest messages', () => {
  it('shows a live message as it arrives', async () => {
    serve({ latest: { data: [msg('m1')], meta: { has_more: false, next_before_id: null } } })

    const { result } = renderHook(() => useMessages('c1'), { wrapper })
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['m1']))
    expect(result.current.hasNewer).toBe(false)

    await broadcast('MessageSent', msg('m2'))

    expect(ids(result.current.messages)).toEqual(['m1', 'm2'])
  })
})
