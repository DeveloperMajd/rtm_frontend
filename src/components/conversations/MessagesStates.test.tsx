import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Messages from './Messages'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import type { MessageType } from '../../utils/baseTypes'

const authValue: AuthContextType = {
  user: { id: 'me', name: 'Me', email: 'me@example.com' },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
  sessionExpired: false,
  signedOutByChoice: false,
  endExpiredSession: vi.fn(),
}

const message = (id: string): MessageType => ({
  id,
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'other', name: 'Jordan' },
  body: `message ${id}`,
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
})

type Props = ComponentProps<typeof Messages>

const renderMessages = (overrides: Partial<Props>) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <Messages
            messages={[]}
            isLoading={false}
            isLoadingMore={false}
            hasMore={false}
            error={null}
            onLoadOlder={vi.fn()}
            onReply={vi.fn()}
            {...overrides}
          />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )

describe('Messages — states', () => {
  it('shows the shape of a conversation while it loads, and says so', () => {
    const { container } = renderMessages({ isLoading: true })

    expect(screen.getByRole('status')).toHaveTextContent('Loading messages…')
    expect(container.querySelectorAll('.msg-skeleton__bubble').length).toBeGreaterThan(0)
  })

  it('invites a first message in an empty conversation, into the composer', async () => {
    const user = userEvent.setup()
    const onStartWriting = vi.fn()
    renderMessages({ greet: 'Kal', onStartWriting })

    expect(screen.getByRole('heading', { name: 'No messages yet' })).toBeInTheDocument()
    expect(screen.getByText('Say hello to Kal. Your first message starts the conversation.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Write a message' }))
    expect(onStartWriting).toHaveBeenCalled()
  })

  it('offers no first message where the viewer can’t send one', () => {
    renderMessages({ readOnly: true, onStartWriting: vi.fn() })

    expect(screen.queryByRole('button', { name: 'Write a message' })).not.toBeInTheDocument()
  })

  it('says a conversation couldn’t open, with a retry and a way back', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderMessages({ error: new Error('Request failed with status code 500'), onRetry })

    expect(screen.getByRole('heading', { name: 'Couldn’t open this conversation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to chats' })).toHaveAttribute('href', '/conversations')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('keeps what’s loaded when older history fails, and retries from the row', async () => {
    const user = userEvent.setup()
    const onLoadOlder = vi.fn()
    renderMessages({
      messages: [message('m1'), message('m2')],
      hasMore: true,
      isOlderError: true,
      error: new Error('Network Error'),
      onLoadOlder,
    })

    expect(screen.getByText('message m1')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load earlier messages.')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onLoadOlder).toHaveBeenCalledTimes(1)
  })
})

describe('Messages — opening at the right place', () => {
  it('doesn’t reach for older history before the conversation has been placed', () => {
    const onLoadOlder = vi.fn()
    // jsdom lays nothing out, so the list looks too short to scroll — the
    // case that loads older history straight away once it's allowed to.
    const { rerender } = renderMessages({ messages: [message('m1')], hasMore: true, isReady: true, onLoadOlder })
    expect(onLoadOlder).not.toHaveBeenCalled()

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <Messages
              messages={[message('m1')]}
              isLoading={false}
              isLoadingMore={false}
              hasMore
              error={null}
              isReady
              onLoadOlder={onLoadOlder}
              onReply={vi.fn()}
              readState={{ unreadCount: 0, lastReadMessageId: 'm1' }}
            />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    expect(onLoadOlder).toHaveBeenCalled()
  })

  it('keeps the skeleton over the messages until they’re in place', () => {
    const { container } = renderMessages({ messages: [message('m1')], isReady: true })

    expect(container.querySelector('.msg-cover .msg-skeleton')).not.toBeNull()
    expect(container.querySelector('.room__scroll')).not.toHaveAttribute('data-positioned')
  })
})

describe('Messages — jumping to a message', () => {
  const reply = (id: string, quoted: MessageType): MessageType => ({
    ...message(id),
    reply_to_message_id: quoted.id,
    reply_to: { id: quoted.id, body: quoted.body, sender: quoted.sender },
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('follows a reply’s quote to the message it quotes', async () => {
    const user = userEvent.setup()
    const onJumpTo = vi.fn()
    renderMessages({ messages: [message('m1'), reply('m2', message('m1'))], onJumpTo })

    await user.click(screen.getByRole('button', { name: 'Jump to original message from Jordan' }))

    expect(onJumpTo).toHaveBeenCalledWith('m1')
  })

  it('lands on the message: the halo for 1.6 s, and focus', () => {
    vi.useFakeTimers()
    const { container } = renderMessages({
      messages: [message('m1'), message('m2'), message('m3')],
      jump: { id: 'm2', seq: 1 },
    })

    const row = container.querySelector<HTMLElement>('[data-message-id="m2"]')!
    expect(row).toHaveAttribute('data-flash')
    expect(row).toHaveFocus()

    act(() => vi.advanceTimersByTime(1600))
    expect(row).not.toHaveAttribute('data-flash')
  })

  it('waits for the message to load before landing on it', () => {
    const jump = { id: 'm5', seq: 1 }
    const { container, rerender } = renderMessages({ messages: [], isLoading: true, jump, anchorId: 'm5' })
    expect(container.querySelector('[data-flash]')).toBeNull()

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <Messages
              messages={[message('m4'), message('m5')]}
              isLoading={false}
              isLoadingMore={false}
              hasMore={false}
              error={null}
              onLoadOlder={vi.fn()}
              onReply={vi.fn()}
              jump={jump}
              anchorId='m5'
            />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(container.querySelector('[data-message-id="m5"]')).toHaveAttribute('data-flash')
  })

  // The divider marks where reading had stopped; a window opened somewhere
  // else in the history isn't that place.
  it('opens a jump’s window without an unread divider', () => {
    renderMessages({
      messages: [message('m4'), message('m5'), message('m6')],
      anchorId: 'm5',
      readState: { unreadCount: 2, lastReadMessageId: 'm4' },
    })

    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('offers the way back to the newest messages while the window stops short of them', async () => {
    const user = userEvent.setup()
    const onJumpToLatest = vi.fn()
    renderMessages({ messages: [message('m5')], anchorId: 'm5', hasNewer: true, onJumpToLatest })

    await user.click(screen.getByRole('button', { name: 'Jump to latest' }))

    expect(onJumpToLatest).toHaveBeenCalled()
  })

  it('keeps what’s loaded when newer history fails, and retries from the row', async () => {
    const user = userEvent.setup()
    const onLoadNewer = vi.fn()
    renderMessages({ messages: [message('m5')], anchorId: 'm5', hasNewer: true, isNewerError: true, onLoadNewer })

    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load newer messages.')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onLoadNewer).toHaveBeenCalled()
  })
})

describe('Messages — read state', () => {
  const own = (id: string): MessageType => ({ ...message(id), sender: { id: 'me', name: 'Me' } })
  const pointer = (userId: string, messageId: string | null) => ({
    user_id: userId,
    last_read_message_id: messageId,
    last_read_at: null,
  })

  it('puts the read state on the viewer’s newest message only — Seen once the other person reads it', () => {
    const readers = [{ user_id: 'other', name: 'Jordan' }]
    const { rerender } = renderMessages({ messages: [own('m1'), own('m2')], readers, readPointers: [pointer('other', 'm1')] })

    expect(screen.getAllByText(/^(Sent|Seen)$/)).toHaveLength(1)
    expect(screen.getByText('Sent')).toBeInTheDocument()

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <Messages
              messages={[own('m1'), own('m2')]}
              isLoading={false}
              isLoadingMore={false}
              hasMore={false}
              error={null}
              onLoadOlder={vi.fn()}
              onReply={vi.fn()}
              readers={readers}
              readPointers={[pointer('other', 'm2')]}
            />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Seen')).toBeInTheDocument()
  })

  it('in a group, says how many of the others have read it', () => {
    renderMessages({
      messages: [own('m1')],
      isGroup: true,
      readers: [
        { user_id: 'a', name: 'Ana' },
        { user_id: 'b', name: 'Ben' },
        { user_id: 'c', name: 'Cy' },
      ],
      readPointers: [pointer('a', 'm1'), pointer('b', 'm1'), pointer('c', null)],
    })

    expect(screen.getByRole('button', { name: 'Seen by 2 of 3 — show who' })).toBeInTheDocument()
  })
})
