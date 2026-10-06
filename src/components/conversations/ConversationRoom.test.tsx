import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'
import toast from 'react-hot-toast'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import useTypingIndicator from '../../hooks/useTypingIndicator'
import ConversationRoom from './ConversationRoom'
import { getConversationById } from '../../services/api/conversations'
import type { ConversationType } from '../../utils/baseTypes'

let conversations: ConversationType[] = []
// False until this mount has fetched the list itself: a fresh load, or a
// link opened in a new tab.
let areConversationsReady = true
// A message window the server refused, by where it was opened (a message
// jumped to, or null for the newest messages).
let refusedWindow: { anchor: string | null; error: Error } | null = null

// The room's live data isn't what's under test here — only its header.
vi.mock('../../hooks/useConversations', () => ({
  default: () => ({ conversations, isReady: areConversationsReady }),
}))
vi.mock('../../hooks/useMessages', () => ({
  default: (_id: string, _readOnly: boolean, { anchor = null }: { anchor?: string | null } = {}) => ({
    messages: [],
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: refusedWindow?.anchor === anchor ? refusedWindow.error : null,
    loadOlder: vi.fn(),
    isReady: true,
    isRefreshing: false,
  }),
}))
vi.mock('../../hooks/useTypingIndicator', () => ({ default: vi.fn(() => '') }))
vi.mock('../../hooks/useReadStateSnapshot', () => ({ useReadStateSnapshot: () => undefined }))
vi.mock('../../services/api/conversations', () => ({ postTyping: vi.fn(), getConversationById: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }))

beforeEach(() => {
  areConversationsReady = true
  refusedWindow = null
  vi.mocked(toast.error).mockClear()
  vi.mocked(useTypingIndicator).mockClear()
})

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

const Providers = ({ children, path }: { children: ReactNode; path: string }) => {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

const room = (path: string) => (
  <Providers path={path}>
    <Routes>
      <Route path='/conversations' element={<p>The list</p>} />
      <Route path='/conversations/:id' element={<ConversationRoom />} />
    </Routes>
  </Providers>
)

const renderRoom = (path = '/conversations/c1') => render(room(path))

const direct = (id: string, unread: number, extra: Partial<ConversationType> = {}) =>
  ({ id, type: 'direct', unread_count: unread, other_participant: { id: `u-${id}`, name: `Person ${id}` }, ...extra }) as ConversationType

describe('ConversationRoom’s back button (phones)', () => {
  it('counts what’s waiting in the other conversations, not this one', async () => {
    const user = userEvent.setup()
    conversations = [
      direct('c1', 4),
      direct('c2', 2),
      direct('c3', 1),
      direct('c4', 7, { viewer_left_at: '2026-09-01T10:00:00Z' }),
    ]
    renderRoom()

    const back = screen.getByRole('button', { name: 'Back to conversations, 3 unread' })
    expect(back).toHaveTextContent('3')

    await user.click(back)
    expect(screen.getByText('The list')).toBeInTheDocument()
  })

  it('is just a way back when nothing else is unread', () => {
    conversations = [direct('c1', 4), direct('c2', 0)]
    renderRoom()

    expect(screen.getByRole('button', { name: 'Back to conversations' })).toHaveTextContent('')
  })
})

const httpError = (status: number) => {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', String(status), config, null, { status, statusText: '', headers: {}, config, data: {} })
}

describe('ConversationRoom for a conversation that isn’t there', () => {
  beforeEach(() => {
    vi.mocked(getConversationById).mockReset()
  })

  it('says so in place, with a way back, rather than silently leaving', async () => {
    const user = userEvent.setup()
    vi.mocked(getConversationById).mockRejectedValue(httpError(404))
    conversations = [direct('c2', 0)]
    renderRoom()

    expect(await screen.findByRole('heading', { name: 'This conversation isn’t available' })).toBeInTheDocument()
    expect(screen.getByText('It may have been deleted, or the link is out of date.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
    expect(getConversationById).toHaveBeenCalledWith('c1')

    await user.click(screen.getByRole('link', { name: 'Back to chats' }))
    expect(screen.getByText('The list')).toBeInTheDocument()
  })

  // A shared link to a conversation someone isn't in: the server says 403.
  it('says when the viewer just isn’t in it, rather than that it’s gone', async () => {
    vi.mocked(getConversationById).mockRejectedValue(httpError(403))
    conversations = [direct('c2', 0)]
    renderRoom()

    expect(await screen.findByRole('heading', { name: 'You’re not in this conversation' })).toBeInTheDocument()
    expect(screen.getByText(/Only the people in it can open it\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to chats' })).toBeInTheDocument()
    expect(screen.queryByText('This conversation isn’t available')).not.toBeInTheDocument()
  })

  it('gives no reason until the server has said which', () => {
    vi.mocked(getConversationById).mockReturnValue(new Promise(() => {}))
    conversations = [direct('c2', 0)]
    renderRoom()

    expect(screen.getByRole('region', { name: 'Conversation' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('doesn’t ask about a conversation that is the viewer’s', () => {
    conversations = [direct('c1', 0)]
    renderRoom()

    expect(getConversationById).not.toHaveBeenCalled()
  })
})

// A fresh load asks for the messages at once, before the list has said
// whether the conversation is the viewer's at all.
describe('ConversationRoom before the list has said whose it is', () => {
  beforeEach(() => {
    vi.mocked(getConversationById).mockReset()
    areConversationsReady = false
    conversations = []
  })

  const listArrives = (rerender: (ui: ReactNode) => void, path: string, ...list: ConversationType[]) => {
    areConversationsReady = true
    conversations = list
    rerender(room(path))
  }

  // A link into a conversation the viewer isn't in, opened in a new tab.
  it('holds a refused jump, rather than a toast on top of “not in it”', async () => {
    vi.mocked(getConversationById).mockRejectedValue(httpError(403))
    refusedWindow = { anchor: 'm1', error: httpError(403) }
    const { rerender } = renderRoom('/conversations/c1?message=m1')

    expect(screen.getByText('Loading messages…')).toBeInTheDocument()

    listArrives(rerender, '/conversations/c1?message=m1', direct('c2', 0))

    expect(await screen.findByRole('heading', { name: 'You’re not in this conversation' })).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('shows loading, not an error, when the newest messages are refused', () => {
    refusedWindow = { anchor: null, error: httpError(403) }
    renderRoom()

    expect(screen.getByText('Loading messages…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Couldn’t open this conversation' })).not.toBeInTheDocument()
  })

  it('still says why a jump failed once the conversation turns out to be theirs', () => {
    refusedWindow = { anchor: 'm1', error: httpError(404) }
    const { rerender } = renderRoom('/conversations/c1?message=m1')
    expect(toast.error).not.toHaveBeenCalled()

    listArrives(rerender, '/conversations/c1?message=m1', direct('c1', 0))

    expect(toast.error).toHaveBeenCalledWith('That message isn’t available. It may be outside the history you can see.', {
      id: 'jump-failed',
    })
  })

  it('doesn’t listen for typing until it’s known to be theirs', () => {
    const { rerender } = renderRoom()
    expect(useTypingIndicator).not.toHaveBeenCalledWith('c1', true)

    listArrives(rerender, '/conversations/c1', direct('c1', 0))

    expect(useTypingIndicator).toHaveBeenLastCalledWith('c1', true)
  })
})
