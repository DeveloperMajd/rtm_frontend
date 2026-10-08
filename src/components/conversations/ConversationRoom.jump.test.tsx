import { useState, type ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import ConversationRoom from './ConversationRoom'
import { sendMessage } from '../../services/api/messages'
import type { ConversationType, MessageType } from '../../utils/baseTypes'

/** What useMessages hands back for each window, by the anchor it was
 * opened at ('latest' for the newest messages). */
type Window = { messages: MessageType[]; hasNewer?: boolean; error?: Error | null; isLoading?: boolean }
let windows: Record<string, Window> = {}

const messagesCalls = vi.fn()
vi.mock('../../hooks/useMessages', () => ({
  default: (conversationId: string, readOnly: boolean, options: { anchor?: string | null }) => {
    messagesCalls(conversationId, readOnly, options)
    const window = windows[options.anchor ?? 'latest'] ?? { messages: [], isLoading: true }
    return {
      messages: window.messages,
      isLoading: window.isLoading ?? false,
      isLoadingMore: false,
      hasMore: false,
      error: window.error ?? null,
      isOlderError: false,
      retry: vi.fn(),
      loadOlder: vi.fn(),
      hasNewer: window.hasNewer ?? false,
      isLoadingNewer: false,
      isNewerError: false,
      loadNewer: vi.fn(),
      isReady: true,
      isRefreshing: false,
    }
  },
}))
vi.mock('../../hooks/useConversations', () => ({
  default: () => ({
    conversations: [
      { id: 'c1', type: 'direct', unread_count: 0, other_participant: { id: 'other', name: 'Jordan' } } as ConversationType,
    ],
    isReady: true,
  }),
}))
vi.mock('../../hooks/useTypingIndicator', () => ({ default: () => '' }))
vi.mock('../../hooks/useReadStateSnapshot', () => ({
  useReadStateSnapshot: () => ({ unreadCount: 0, lastReadMessageId: null }),
}))
vi.mock('../../services/api/conversations', () => ({ postTyping: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../services/api/messages', () => ({ sendMessage: vi.fn() }))
vi.mock('../../services/api/savedMessages', () => ({ getSavedMessageIds: vi.fn().mockResolvedValue([]) }))

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

const message = (id: string, extra: Partial<MessageType> = {}): MessageType => ({
  id,
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'other', name: 'Jordan' },
  body: `message ${id}`,
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  ...extra,
})

const replyTo = (id: string, quotedId: string) =>
  message(id, {
    reply_to_message_id: quotedId,
    reply_to: { id: quotedId, body: `message ${quotedId}`, sender: { id: 'other', name: 'Jordan' } },
  })

const Where = () => {
  const location = useLocation()
  return <output aria-label='Address'>{location.pathname + location.search}</output>
}

const Providers = ({ children, at }: { children: ReactNode; at: string }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[at]}>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

const renderRoom = (at = '/conversations/c1') =>
  render(
    <Providers at={at}>
      <Routes>
        <Route
          path='/conversations/:id'
          element={
            <>
              <ConversationRoom />
              <Where />
            </>
          }
        />
      </Routes>
      <Toaster />
    </Providers>,
  )

/** The window the room is showing now. */
const currentAnchor = () => messagesCalls.mock.lastCall?.[2].anchor ?? null

const row = (id: string) => document.querySelector(`[data-message-id="${id}"]`)

beforeAll(() => {
  // jsdom has no matchMedia; the Toaster asks it about reduced motion.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

beforeEach(() => {
  messagesCalls.mockClear()
  windows = {}
})

afterEach(() => {
  toast.remove()
})

describe('ConversationRoom — jumping to a message', () => {
  it('opens a link to a message around that message, then drops it from the address', async () => {
    windows = { m9: { messages: [message('m8'), message('m9')], hasNewer: true } }

    renderRoom('/conversations/c1?message=m9')

    // Never the newest messages first, only to swap them out.
    expect(messagesCalls.mock.calls.every(([, , options]) => options.anchor === 'm9')).toBe(true)
    expect(row('m9')).toHaveAttribute('data-flash')
    await waitFor(() => expect(screen.getByRole('status', { name: 'Address' })).toHaveTextContent(/^\/conversations\/c1$/))
    expect(currentAnchor()).toBe('m9')
  })

  it('follows a quote to a message already on screen without opening another window', async () => {
    const user = userEvent.setup()
    windows = { latest: { messages: [message('m3'), replyTo('m4', 'm3')] } }
    renderRoom()

    await user.click(screen.getByRole('button', { name: 'Jump to original message from Jordan' }))

    expect(currentAnchor()).toBeNull()
    expect(row('m3')).toHaveAttribute('data-flash')
    expect(row('m3')).toHaveFocus()
  })

  it('opens the history around a quoted message that isn’t loaded', async () => {
    const user = userEvent.setup()
    windows = {
      latest: { messages: [replyTo('m4', 'm1')] },
      m1: { messages: [message('m1'), message('m2')], hasNewer: true },
    }
    renderRoom()

    await user.click(screen.getByRole('button', { name: 'Jump to original message from Jordan' }))

    expect(currentAnchor()).toBe('m1')
    expect(row('m1')).toHaveAttribute('data-flash')
  })

  it('goes back to the newest messages from a jump’s window', async () => {
    const user = userEvent.setup()
    windows = {
      latest: { messages: [message('m9')] },
      m2: { messages: [message('m2')], hasNewer: true },
    }
    renderRoom('/conversations/c1?message=m2')

    await user.click(screen.getByRole('button', { name: 'Jump to latest' }))

    expect(currentAnchor()).toBeNull()
    expect(row('m9')).toBeInTheDocument()
  })

  it('says so when the message isn’t there, and shows the newest messages instead', async () => {
    const notFound = new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 404,
      data: {},
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse)
    windows = {
      latest: { messages: [message('m9')] },
      gone: { messages: [], error: notFound },
    }

    renderRoom('/conversations/c1?message=gone')

    expect(
      await screen.findByText('That message isn’t available. It may be outside the history you can see.'),
    ).toBeInTheDocument()
    expect(currentAnchor()).toBeNull()
    expect(row('m9')).toBeInTheDocument()
  })

  it('offers to try again when opening the message failed for another reason', async () => {
    const user = userEvent.setup()
    windows = {
      latest: { messages: [message('m9')] },
      m2: { messages: [], error: new Error('Network Error') },
    }
    renderRoom('/conversations/c1?message=m2')

    expect(await screen.findByText('Couldn’t open that message')).toBeInTheDocument()
    expect(currentAnchor()).toBeNull()

    windows.m2 = { messages: [message('m2')] }
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(currentAnchor()).toBe('m2')
  })

  // What was just sent is at the newest end, which a jump's window doesn't
  // reach — so the room goes there.
  it('goes to the newest messages after sending from a jump’s window', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(message('m10', { sender: { id: 'me', name: 'Me' } }))
    windows = {
      latest: { messages: [message('m9')] },
      m2: { messages: [message('m2')], hasNewer: true },
    }
    renderRoom('/conversations/c1?message=m2')

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'hello{Enter}')

    await waitFor(() => expect(currentAnchor()).toBeNull())
  })
})
