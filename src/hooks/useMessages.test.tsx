import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useMessages from './useMessages'
import { AuthContext, type AuthContextType } from './useAuth'
import { getMessagesPage, type MessagesPageParam } from '../services/api/messages'
import { markConversationAsRead, type ReadPointer } from '../services/api/conversations'
import { readPointersKey } from '../utils/readReceipts'
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

const auth: AuthContextType = {
  user: { id: 'me', name: 'Me', email: 'me@example.com' },
  isAuthenticated: true,
  isLoading: false,
  sessionExpired: false,
  signedOutByChoice: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
  endExpiredSession: vi.fn(),
}

let client: QueryClient

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>
    <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
  </QueryClientProvider>
)

/** Whether the viewer is looking: the tab visible, the window focused. */
let tabVisible = true
let windowFocused = true
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (tabVisible ? 'visible' : 'hidden') })

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
  client = new QueryClient()
  fetchPage.mockReset()
  vi.mocked(markConversationAsRead).mockClear()
  for (const event of Object.keys(echo.handlers)) delete echo.handlers[event]
  tabVisible = true
  windowFocused = true
  vi.spyOn(document, 'hasFocus').mockImplementation(() => windowFocused)
})

afterEach(() => {
  vi.restoreAllMocks()
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

describe('useMessages — marking as read', () => {
  const latest = (...ids: string[]) =>
    serve({ latest: { data: ids.map(msg), meta: { has_more: false, next_before_id: null } } })

  const marked = () => vi.mocked(markConversationAsRead).mock.calls

  it('marks read up to the newest message on screen, once the viewer is looking', async () => {
    latest('m1', 'm2')
    renderHook(() => useMessages('c1'), { wrapper })

    await waitFor(() => expect(marked()).toEqual([['c1', 'm2']]))
  })

  // One request and one broadcast for a burst, not one for each message.
  it('reads a burst of messages in one go', async () => {
    latest('m1')
    const { result } = renderHook(() => useMessages('c1'), { wrapper })
    await waitFor(() => expect(marked()).toHaveLength(1))

    await broadcast('MessageSent', msg('m2'))
    await broadcast('MessageSent', msg('m3'))
    await broadcast('MessageSent', msg('m4'))

    await waitFor(() => expect(marked()).toHaveLength(2))
    expect(marked()[1]).toEqual(['c1', 'm4'])
    expect(result.current.messages.at(-1)?.id).toBe('m4')
  })

  it('leaves a message that arrives in a background tab unread until the viewer comes back', async () => {
    latest('m1')
    renderHook(() => useMessages('c1'), { wrapper })
    await waitFor(() => expect(marked()).toHaveLength(1))

    tabVisible = false
    await broadcast('MessageSent', msg('m2'))
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(marked()).toHaveLength(1)

    tabVisible = true
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    await waitFor(() => expect(marked()).toEqual([['c1', 'm1'], ['c1', 'm2']]))
  })

  it('and while the window is in the background, until it has focus again', async () => {
    windowFocused = false
    latest('m1')
    renderHook(() => useMessages('c1'), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(marked()).toHaveLength(0)

    windowFocused = true
    act(() => window.dispatchEvent(new Event('focus')))

    await waitFor(() => expect(marked()).toEqual([['c1', 'm1']]))
  })

  it('counts a message from someone else as unread in the list while the viewer isn’t looking', async () => {
    latest('m1')
    client.setQueryData(['conversations'], { data: [{ id: 'c1', type: 'direct', unread_count: 0 }] })
    renderHook(() => useMessages('c1'), { wrapper })
    await waitFor(() => expect(marked()).toHaveLength(1))

    tabVisible = false
    await broadcast('MessageSent', msg('m2'))
    await broadcast('MessageSent', { ...msg('m3'), sender: { id: 'me', name: 'Me' } })

    expect(client.getQueryData<{ data: { unread_count: number }[] }>(['conversations'])?.data[0].unread_count).toBe(1)
  })

  it('marks nothing in a group the viewer has left', async () => {
    latest('m1')
    renderHook(() => useMessages('c1', true), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 900))

    expect(marked()).toHaveLength(0)
  })

  it('takes others’ reads as they happen, furthest first', async () => {
    latest('m1')
    const pointers: ReadPointer[] = [{ user_id: 'jo', last_read_message_id: 'm0', last_read_at: null }]
    client.setQueryData(readPointersKey('c1'), pointers)
    renderHook(() => useMessages('c1'), { wrapper })
    await waitFor(() => expect(echo.handlers.ConversationRead).toBeDefined())

    await broadcast('ConversationRead', { user_id: 'jo', last_read_message_id: 'm1', last_read_at: '2026-09-30T10:00:00Z' })

    expect(client.getQueryData<ReadPointer[]>(readPointersKey('c1'))).toEqual([
      { user_id: 'jo', last_read_message_id: 'm1', last_read_at: '2026-09-30T10:00:00Z' },
    ])
  })
})
