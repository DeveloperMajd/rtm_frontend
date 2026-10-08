import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import Conversations from './Conversations'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import { updateConversationPreferences } from '../../services/api/conversations'
import type { ConversationType } from '../../utils/baseTypes'

vi.mock('../../services/api/conversations', () => ({ updateConversationPreferences: vi.fn() }))

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

let client: QueryClient

const withProviders = (ui: ReactNode) => (
  <QueryClientProvider client={client}>
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
    </MemoryRouter>
    <Toaster />
  </QueryClientProvider>
)

const renderWithProviders = (ui: ReactNode) => render(withProviders(ui))

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
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  vi.mocked(updateConversationPreferences).mockReset()
})

afterEach(() => {
  toast.remove()
})

const conversation = (overrides: Partial<ConversationType>): ConversationType => ({
  id: overrides.id ?? 'c1',
  type: 'direct',
  created_by_user_id: 'me',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  other_participant: { id: 'other', name: 'Jordan', is_online: false },
  ...overrides,
})

describe('Conversations', () => {
  it('slides a chat to the top when it gets a new message, rather than jumping it there', () => {
    const realOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!
    const animate = vi.fn()
    // jsdom lays nothing out: a row's place is its position in the list.
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        return this.parentElement ? [...this.parentElement.children].indexOf(this) * 72 : 0
      },
    })
    HTMLElement.prototype.animate = animate
    try {
      const ana = conversation({ id: 'a', other_participant: { id: 'a', name: 'Ana', is_online: false } })
      const ben = conversation({ id: 'b', other_participant: { id: 'b', name: 'Ben', is_online: false } })
      const { rerender } = renderWithProviders(<Conversations conversations={[ana, ben]} isLoading={false} error={null} />)

      rerender(withProviders(<Conversations conversations={[ben, ana]} isLoading={false} error={null} />))

      expect(animate.mock.contexts.map((row) => (row as HTMLElement).dataset.reorderId)).toEqual(['b', 'a'])
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', realOffsetTop)
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    }
  })

  it('marks the person in a direct conversation online, away or offline by their dot', () => {
    const list = [
      conversation({ id: 'a', other_participant: { id: 'a', name: 'Ana', is_online: true, presence_status: 'online' } }),
      conversation({ id: 'b', other_participant: { id: 'b', name: 'Ben', is_online: true, presence_status: 'away' } }),
      conversation({ id: 'c', other_participant: { id: 'c', name: 'Cy', is_online: false, presence_status: 'offline' } }),
      // From a server before away presence: online or not.
      conversation({ id: 'd', other_participant: { id: 'd', name: 'Di', is_online: true } }),
    ]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} />)

    const dotOf = (name: string) => screen.getByRole('link', { name: new RegExp(name) }).querySelector('.avatar__status')
    expect(dotOf('Ana')).toHaveClass('is-online')
    expect(dotOf('Ben')).toHaveClass('is-away')
    expect(dotOf('Cy')).toHaveClass('is-offline')
    expect(dotOf('Di')).toHaveClass('is-online')
  })

  it('shows every conversation with the default "all" filter', () => {
    const list = [
      conversation({ id: 'direct-1', type: 'direct' }),
      conversation({ id: 'group-1', type: 'group', title: 'Team' }),
    ]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} />)
    expect(screen.getByText('Jordan')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
  })

  it('filters to unread conversations only', () => {
    const list = [
      conversation({
        id: 'unread',
        unread_count: 2,
        other_participant: { id: 'a', name: 'Has unread', is_online: false },
      }),
      conversation({
        id: 'read',
        unread_count: 0,
        other_participant: { id: 'b', name: 'No unread', is_online: false },
      }),
    ]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} filter='unread' />)
    expect(screen.getByText('Has unread')).toBeInTheDocument()
    expect(screen.queryByText('No unread')).not.toBeInTheDocument()
  })

  it('excludes a left group from the unread filter even if unread_count were non-zero', () => {
    const list = [
      conversation({
        id: 'left-group',
        type: 'group',
        title: 'Old group',
        unread_count: 5,
        viewer_left_at: '2026-01-01T00:00:00Z',
      }),
    ]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} filter='unread' />)
    expect(screen.getByRole('heading', { name: 'You’re all caught up' })).toBeInTheDocument()
  })

  it('filters by type for groups and direct', () => {
    const list = [
      conversation({ id: 'g', type: 'group', title: 'Group chat' }),
      conversation({
        id: 'd',
        type: 'direct',
        other_participant: { id: 'x', name: 'Direct chat', is_online: false },
      }),
    ]
    const { rerender } = renderWithProviders(
      <Conversations conversations={list} isLoading={false} error={null} filter='groups' />,
    )
    expect(screen.getByText('Group chat')).toBeInTheDocument()
    expect(screen.queryByText('Direct chat')).not.toBeInTheDocument()

    rerender(withProviders(<Conversations conversations={list} isLoading={false} error={null} filter='direct' />))
    expect(screen.getByText('Direct chat')).toBeInTheDocument()
    expect(screen.queryByText('Group chat')).not.toBeInTheDocument()
  })

  it('shows a filter-specific empty state rather than the generic one, with its way forward', async () => {
    const user = userEvent.setup()
    const onNewGroup = vi.fn()
    renderWithProviders(
      <Conversations conversations={[]} isLoading={false} error={null} filter='groups' onNewGroup={onNewGroup} />,
    )

    expect(screen.getByRole('heading', { name: 'No groups yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New group' }))
    expect(onNewGroup).toHaveBeenCalled()
  })

  it('offers a new account both ways to start', () => {
    renderWithProviders(
      <Conversations conversations={[]} isLoading={false} error={null} onAddContact={vi.fn()} onNewGroup={vi.fn()} />,
    )

    const state = screen.getByRole('status')
    expect(state).toHaveTextContent('No conversations yet')
    expect(screen.getByRole('button', { name: 'Add contact' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New group' })).toBeInTheDocument()
  })

  it('goes back to all conversations from an empty Unread filter', async () => {
    const user = userEvent.setup()
    const onShowAll = vi.fn()
    renderWithProviders(
      <Conversations conversations={[]} isLoading={false} error={null} filter='unread' onShowAll={onShowAll} />,
    )

    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(onShowAll).toHaveBeenCalled()
  })

  it('says the list couldn’t load, with a retry, only when there’s no list to show', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = renderWithProviders(
      <Conversations conversations={[]} isLoading={false} error={new Error('Network Error')} onRetry={onRetry} />,
    )

    expect(screen.getByRole('heading', { name: 'Couldn’t load your chats' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()

    // A failed background refresh keeps what's already there.
    rerender(withProviders(<Conversations conversations={[conversation({ id: 'c1', title: 'Still here', type: 'group' })]} isLoading={false} error={new Error('Network Error')} />))
    expect(screen.getByText('Still here')).toBeInTheDocument()
  })

  it('puts Pin, Mute and Archive beside each row’s link, not inside it', () => {
    renderWithProviders(<Conversations conversations={[conversation({ id: 'c1' })]} isLoading={false} error={null} />)

    // Nesting a <button> inside an <a> is invalid HTML — these must be siblings.
    expect(within(screen.getByRole('link')).queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Pin Jordan' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Mute Jordan' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Archive Jordan' })).toBeEnabled()
  })

  it('offers only Archive for a group the viewer has left', () => {
    const list = [conversation({ id: 'left', type: 'group', title: 'Left group', viewer_left_at: '2026-01-01T00:00:00Z' })]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} />)

    expect(screen.queryByRole('button', { name: 'Pin Left group' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mute Left group' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive Left group' })).toBeInTheDocument()
  })

  it('lists pinned conversations first, under their own heading, and marks muted ones', () => {
    const list = [
      conversation({ id: 'a', other_participant: { id: 'a', name: 'Ana', is_online: false }, muted_at: '2026-01-02T00:00:00Z', unread_count: 3 }),
      conversation({ id: 'b', other_participant: { id: 'b', name: 'Ben', is_online: false }, pinned_at: '2026-01-02T00:00:00Z' }),
    ]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} />)

    const pinned = screen.getByRole('group', { name: 'Pinned' })
    expect(within(pinned).getByRole('link')).toHaveTextContent(/Ben, pinned/)
    const chats = screen.getByRole('group', { name: 'Chats' })
    expect(within(chats).getByRole('link')).toHaveTextContent(/Ana, muted/)
    expect(within(chats).getByLabelText('3 unread messages')).toHaveClass('is-muted')
  })

  it('needs no headings when nothing is pinned', () => {
    renderWithProviders(<Conversations conversations={[conversation({ id: 'c1' })]} isLoading={false} error={null} />)
    expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument()
  })

  it('pins at once, and says so if the server refuses — putting it back', async () => {
    const user = userEvent.setup()
    let refuse!: (error: Error) => void
    vi.mocked(updateConversationPreferences).mockReturnValue(new Promise((_resolve, reject) => (refuse = reject)))
    client.setQueryData(['conversations'], { data: [conversation({ id: 'c1' })] })
    const cached = () => client.getQueryData<{ data: ConversationType[] }>(['conversations'])!.data[0]

    renderWithProviders(<Conversations conversations={[conversation({ id: 'c1' })]} isLoading={false} error={null} />)
    await user.click(screen.getByRole('button', { name: 'Pin Jordan' }))

    expect(updateConversationPreferences).toHaveBeenCalledWith('c1', { pinned: true })
    expect(cached().pinned_at).toEqual(expect.any(String))

    refuse(new Error('Network Error'))

    expect(await screen.findByText('Couldn’t pin the conversation')).toBeInTheDocument()
    expect(cached().pinned_at).toBeNull()
  })

  it('keeps archived conversations out of the list, behind Archived', async () => {
    const user = userEvent.setup()
    const onShowArchived = vi.fn()
    const list = [
      conversation({ id: 'a', other_participant: { id: 'a', name: 'Ana', is_online: false } }),
      conversation({ id: 'b', other_participant: { id: 'b', name: 'Ben', is_online: false }, archived_at: '2026-01-02T00:00:00Z' }),
    ]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} onShowArchived={onShowArchived} />)

    expect(screen.queryByText('Ben')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Archived\s*1/ }))
    expect(onShowArchived).toHaveBeenCalled()
  })

  it('shows the archived conversations in their own view, with the way back', async () => {
    const user = userEvent.setup()
    const onShowChats = vi.fn()
    const list = [
      conversation({ id: 'a', other_participant: { id: 'a', name: 'Ana', is_online: false } }),
      conversation({ id: 'b', other_participant: { id: 'b', name: 'Ben', is_online: false }, archived_at: '2026-01-02T00:00:00Z' }),
    ]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} view='archived' onShowChats={onShowChats} />)

    expect(screen.getByRole('heading', { name: 'Archived' })).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unarchive Ben' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to chats' }))
    expect(onShowChats).toHaveBeenCalled()
  })

  it('says when everything is archived, rather than that there’s nothing', () => {
    const list = [conversation({ id: 'b', archived_at: '2026-01-02T00:00:00Z' })]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} onShowArchived={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'All your chats are archived' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Archived\s*1/ })).toBeInTheDocument()
  })

  it('archives with an Undo', async () => {
    const user = userEvent.setup()
    const archivedAt = '2026-01-02T00:00:00Z'
    vi.mocked(updateConversationPreferences)
      .mockResolvedValueOnce({ pinned_at: null, muted_at: null, archived_at: archivedAt })
      .mockResolvedValueOnce({ pinned_at: null, muted_at: null, archived_at: null })
    client.setQueryData(['conversations'], { data: [conversation({ id: 'c1' })] })

    renderWithProviders(<Conversations conversations={[conversation({ id: 'c1' })]} isLoading={false} error={null} />)
    await user.click(screen.getByRole('button', { name: 'Archive Jordan' }))

    await user.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(updateConversationPreferences).toHaveBeenLastCalledWith('c1', { archived: false }))
    await waitFor(() =>
      expect(client.getQueryData<{ data: ConversationType[] }>(['conversations'])!.data[0].archived_at).toBeNull(),
    )
  })
})
