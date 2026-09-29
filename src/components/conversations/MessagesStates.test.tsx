import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
