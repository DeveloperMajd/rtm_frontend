import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'
import toast from 'react-hot-toast'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import { forgetTyping, noteTyping } from '../../hooks/useListTyping'
import useMessageReactions from '../../hooks/useMessageReactions'
import ConversationRoom from './ConversationRoom'
import { getConversationById } from '../../services/api/conversations'
import { getSavedMessageIds } from '../../services/api/savedMessages'
import type { ConversationType, MessageType } from '../../utils/baseTypes'
import type { AppShellContext, ListTab } from '../../layouts/appShellContext'

let conversations: ConversationType[] = []
let roomMessages: MessageType[] = []
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
    messages: roomMessages,
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: refusedWindow?.anchor === anchor ? refusedWindow.error : null,
    loadOlder: vi.fn(),
    isReady: true,
    isRefreshing: false,
  }),
}))
// Called once each time a message row renders: a way to count them.
vi.mock('../../hooks/useMessageReactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useMessageReactions')>()
  return { default: vi.fn(actual.default) }
})
vi.mock('../../hooks/useReadStateSnapshot', () => ({ useReadStateSnapshot: () => undefined }))
vi.mock('../../services/api/conversations', () => ({ postTyping: vi.fn(), getConversationById: vi.fn() }))
vi.mock('../../services/api/savedMessages', () => ({ getSavedMessageIds: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }))

beforeEach(() => {
  areConversationsReady = true
  refusedWindow = null
  roomMessages = []
  vi.mocked(getSavedMessageIds).mockResolvedValue([])
  vi.mocked(toast.error).mockClear()
  forgetTyping()
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

/** What AppShell hands the screens below it, with `activeTab` the list the
 * room was opened from. */
const Shell = ({ activeTab }: { activeTab: ListTab }) => {
  const context: AppShellContext = {
    activeTab,
    setActiveTab: vi.fn(),
    openSearch: vi.fn(),
    signal: 'connected',
    connection: 'connected',
    recovered: false,
  }
  return <Outlet context={context} />
}

const room = (path: string, from?: ListTab) => (
  <Providers path={path}>
    <Routes>
      <Route path='/conversations' element={<p>The list</p>} />
      {from ? (
        <Route element={<Shell activeTab={from} />}>
          <Route path='/conversations/:id' element={<ConversationRoom />} />
        </Route>
      ) : (
        <Route path='/conversations/:id' element={<ConversationRoom />} />
      )}
    </Routes>
  </Providers>
)

const renderRoom = (path = '/conversations/c1', from?: ListTab) => render(room(path, from))

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

  // Saved stays open behind a message opened from it.
  it('goes back to Saved when the room was opened from there, and says so', () => {
    conversations = [direct('c1', 0), direct('c2', 2)]
    const { unmount } = renderRoom('/conversations/c1', 'saved')

    expect(screen.getByRole('button', { name: 'Back to saved messages, 2 unread chats' })).toHaveTextContent('2')
    unmount()

    conversations = [direct('c1', 0)]
    renderRoom('/conversations/c1', 'saved')
    expect(screen.getByRole('button', { name: 'Back to saved messages' })).toBeInTheDocument()
  })
})

const posted = (id: string, extra: Partial<MessageType> = {}): MessageType => ({
  id,
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'u-c1', name: 'Person c1' },
  body: `Message ${id}`,
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  ...extra,
})

describe('ConversationRoom’s header', () => {
  it('says when the other person is away, rather than online', () => {
    conversations = [
      direct('c1', 0, {
        other_participant: { id: 'u-c1', name: 'Person c1', is_online: true, presence_status: 'away' },
      }),
    ]
    renderRoom()

    expect(screen.getByText('Away')).toBeInTheDocument()
    expect(screen.queryByText('Online')).not.toBeInTheDocument()
    // The header's avatar says the same, with the half-filled dot.
    expect(document.querySelector('.room__header .avatar__status')).toHaveClass('is-away')
  })
})

describe('ConversationRoom and saved messages', () => {
  it('offers to take a saved message off the list, and to save the others', async () => {
    const user = userEvent.setup()
    vi.mocked(getSavedMessageIds).mockResolvedValue(['m2'])
    conversations = [direct('c1', 0)]
    roomMessages = [posted('m1'), posted('m2', { sender: { id: 'me', name: 'Me' } })]
    renderRoom()

    const moreFor = (id: string) =>
      within(document.querySelector(`[data-message-id="${id}"]`) as HTMLElement).getByRole('button', {
        name: 'More actions',
      })

    await user.click(moreFor('m2'))
    expect(await screen.findByRole('menuitem', { name: 'Remove from saved' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(moreFor('m1'))
    expect(screen.getByRole('menuitem', { name: 'Save message' })).toBeInTheDocument()
    expect(getSavedMessageIds).toHaveBeenCalledTimes(1)
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
})

// The room holds the whole message list. What goes on around it — someone
// typing, the chat list changing — mustn't render every message again.
describe('ConversationRoom while things happen around the messages', () => {
  const rowRenders = () => vi.mocked(useMessageReactions).mock.calls.length

  beforeEach(() => {
    conversations = [direct('c1', 0)]
    roomMessages = [posted('m1'), posted('m2'), posted('m3', { sender: { id: 'me', name: 'Me' } })]
  })

  it('says who’s typing above the composer, in this conversation only', () => {
    renderRoom()

    act(() => noteTyping('c2', 'sam', 'Sam'))
    expect(screen.queryByText(/typing/)).not.toBeInTheDocument()

    act(() => noteTyping('c1', 'jo', 'Jo'))
    expect(screen.getByText('Jo is typing…')).toBeInTheDocument()

    act(() => noteTyping('c1', 'sam', 'Sam'))
    expect(screen.getByText('Jo and Sam are typing…')).toBeInTheDocument()
  })

  it('renders no message again while someone types', () => {
    renderRoom()
    const before = rowRenders()
    expect(before).toBeGreaterThan(0)

    act(() => noteTyping('c1', 'jo', 'Jo'))
    act(() => noteTyping('c1', 'sam', 'Sam'))
    act(() => forgetTyping())

    expect(rowRenders()).toBe(before)
  })

  it('renders no message again when the chat list changes', () => {
    const { rerender } = renderRoom()
    const before = rowRenders()

    conversations = [
      direct('c1', 0, { other_participant: { id: 'u-c1', name: 'Person c1', is_online: true, presence_status: 'away' } }),
      direct('c2', 3),
    ]
    rerender(room('/conversations/c1'))

    // The room itself did take the change.
    expect(screen.getByText('Away')).toBeInTheDocument()
    expect(rowRenders()).toBe(before)
  })
})
