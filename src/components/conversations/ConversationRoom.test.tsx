import { useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import ConversationRoom from './ConversationRoom'
import type { ConversationType } from '../../utils/baseTypes'

let conversations: ConversationType[] = []

// The room's live data isn't what's under test here — only its header.
vi.mock('../../hooks/useConversations', () => ({
  default: () => ({ conversations, isReady: true }),
}))
vi.mock('../../hooks/useMessages', () => ({
  default: () => ({
    messages: [],
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: null,
    loadOlder: vi.fn(),
    isReady: true,
    isRefreshing: false,
  }),
}))
vi.mock('../../hooks/useTypingIndicator', () => ({ default: () => '' }))
vi.mock('../../hooks/useReadStateSnapshot', () => ({ useReadStateSnapshot: () => undefined }))
vi.mock('../../services/api/conversations', () => ({ postTyping: vi.fn() }))

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

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient())
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
        <Route path='/conversations' element={<p>The list</p>} />
        <Route path='/conversations/:id' element={<ConversationRoom />} />
      </Routes>
    </Providers>,
  )

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

describe('ConversationRoom for a conversation that isn’t there', () => {
  it('says so in place, with a way back, rather than silently leaving', async () => {
    const user = userEvent.setup()
    conversations = [direct('c2', 0)]
    renderRoom()

    expect(screen.getByRole('heading', { name: 'This conversation isn’t available' })).toBeInTheDocument()
    expect(screen.getByText('It may have been deleted, or the link is out of date.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Back to chats' }))
    expect(screen.getByText('The list')).toBeInTheDocument()
  })
})
