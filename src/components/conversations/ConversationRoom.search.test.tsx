import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import ConversationRoom from './ConversationRoom'
import { searchConversation } from '../../services/api/messages'
import type { ConversationType, MessageSearchResultType, MessageType } from '../../utils/baseTypes'

/** What useMessages hands back for each window, by the anchor it was
 * opened at ('latest' for the newest messages). */
let windows: Record<string, { messages: MessageType[]; hasNewer?: boolean }> = {}

const messagesCalls = vi.fn()
vi.mock('../../hooks/useMessages', () => ({
  default: (conversationId: string, readOnly: boolean, options: { anchor?: string | null }) => {
    messagesCalls(conversationId, readOnly, options)
    const window = windows[options.anchor ?? 'latest'] ?? { messages: [] }
    return {
      messages: window.messages,
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      error: null,
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
vi.mock('../../services/api/messages', () => ({
  CONVERSATION_SEARCH_LIMIT: 50,
  sendMessage: vi.fn(),
  searchConversation: vi.fn(),
}))
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

const message = (id: string, body: string): MessageType => ({
  id,
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'other', name: 'Jordan' },
  body,
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
})

const match = (id: string, body: string): MessageSearchResultType => ({
  id,
  conversation_id: 'c1',
  conversation_title: 'Jordan',
  body,
  sender: { id: 'other', name: 'Jordan' },
  created_at: '2026-01-01T10:00:00Z',
})

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/conversations/c1']}>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

const renderRoom = () =>
  render(
    <Providers>
      <Routes>
        <Route path='/conversations/:id' element={<ConversationRoom />} />
      </Routes>
    </Providers>,
  )

const currentAnchor = () => messagesCalls.mock.lastCall?.[2].anchor ?? null
const row = (id: string) => document.querySelector<HTMLElement>(`[data-message-id="${id}"]`)!
const field = () => screen.getByRole('searchbox', { name: 'Search in this conversation' })
const bar = () => screen.getByRole('search', { name: 'In this conversation' })

beforeEach(() => {
  messagesCalls.mockClear()
  vi.mocked(searchConversation).mockReset()
  windows = {
    latest: { messages: [message('m1', 'redis is down'), message('m2', 'something else'), message('m3', 'redis is back')] },
  }
})

describe('ConversationRoom — searching this conversation', () => {
  it('opens from the header, straight into the field', async () => {
    const user = userEvent.setup()
    renderRoom()

    const toggle = screen.getByRole('button', { name: 'Search this conversation' })
    await user.click(toggle)

    expect(field()).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows the newest match first, ringed, with the words marked, and keeps the caret in the field', async () => {
    const user = userEvent.setup()
    vi.mocked(searchConversation).mockResolvedValue({
      results: [match('m3', 'redis is back'), match('m1', 'redis is down')],
      total: 2,
    })
    renderRoom()
    await user.click(screen.getByRole('button', { name: 'Search this conversation' }))

    await user.type(field(), 'redis')

    expect(await within(bar()).findByText('1 of 2')).toBeInTheDocument()
    expect(searchConversation).toHaveBeenCalledWith('c1', 'redis')
    expect(row('m3')).toHaveClass('is-current-match')
    expect(screen.getAllByText('redis', { selector: 'mark' })).toHaveLength(2)
    expect(field()).toHaveFocus()
    // Already on screen: no other window was opened for it.
    expect(currentAnchor()).toBeNull()
  })

  it('steps back with Enter, opening the history around a match that isn’t loaded', async () => {
    const user = userEvent.setup()
    windows.m0 = { messages: [message('m0', 'redis long ago')], hasNewer: true }
    vi.mocked(searchConversation).mockResolvedValue({
      results: [match('m3', 'redis is back'), match('m0', 'redis long ago')],
      total: 2,
    })
    renderRoom()
    await user.click(screen.getByRole('button', { name: 'Search this conversation' }))
    await user.type(field(), 'redis')
    await within(bar()).findByText('1 of 2')

    await user.keyboard('{Enter}')

    expect(within(bar()).getByText('2 of 2')).toBeInTheDocument()
    expect(currentAnchor()).toBe('m0')
    expect(row('m0')).toHaveClass('is-current-match')
    expect(field()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Older match' })).toBeDisabled()

    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(within(bar()).getByText('1 of 2')).toBeInTheDocument()
  })

  it('says how many it can step through when there are more', async () => {
    const user = userEvent.setup()
    vi.mocked(searchConversation).mockResolvedValue({
      results: Array.from({ length: 50 }, (_, i) => match(i === 0 ? 'm3' : `old-${i}`, 'redis')),
      total: 73,
    })
    renderRoom()
    await user.click(screen.getByRole('button', { name: 'Search this conversation' }))
    await user.type(field(), 'redis')

    expect(await within(bar()).findByText('1 of 50+')).toBeInTheDocument()
    expect(within(bar()).getByText('Match 1 of the newest 50, 73 in all.')).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    vi.mocked(searchConversation).mockResolvedValue({ results: [], total: 0 })
    renderRoom()
    await user.click(screen.getByRole('button', { name: 'Search this conversation' }))
    await user.type(field(), 'zebra')

    expect(await within(bar()).findByText('No matches')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Older match' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Newer match' })).toBeDisabled()
  })

  it('closes with Esc: the marks go, and focus goes back to the header button', async () => {
    const user = userEvent.setup()
    vi.mocked(searchConversation).mockResolvedValue({ results: [match('m3', 'redis is back')], total: 1 })
    renderRoom()
    await user.click(screen.getByRole('button', { name: 'Search this conversation' }))
    await user.type(field(), 'redis')
    await within(bar()).findByText('1 of 1')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('search', { name: 'In this conversation' })).not.toBeInTheDocument()
    expect(screen.queryAllByText('redis', { selector: 'mark' })).toHaveLength(0)
    expect(row('m3')).not.toHaveClass('is-current-match')
    expect(screen.getByRole('button', { name: 'Search this conversation' })).toHaveFocus()

    // Opened again, it starts empty.
    await user.click(screen.getByRole('button', { name: 'Search this conversation' }))
    expect(field()).toHaveValue('')
  })
})
