import { useState, type ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import SavedMessages from './SavedMessages'
import {
  getSavedMessages,
  unsaveMessage,
  type SavedMessage,
  type SavedMessagesPage,
} from '../../services/api/savedMessages'

vi.mock('../../services/api/savedMessages', () => ({
  getSavedMessages: vi.fn(),
  saveMessage: vi.fn(),
  unsaveMessage: vi.fn(),
}))

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

/** Sam's message in the group Team, unless told otherwise. */
const saved = (
  id: string,
  extra: { message?: Partial<SavedMessage['message']>; conversation?: Partial<SavedMessage['conversation']> } = {},
): SavedMessage => ({
  id: `s-${id}`,
  saved_at: '2025-03-05T12:00:00Z',
  message: {
    id,
    conversation_id: extra.conversation?.id ?? 'g1',
    type: 'user',
    sender: { id: 'sam', name: 'Sam' },
    body: `Message ${id}`,
    attachments: [],
    created_at: '2025-03-04T12:00:00Z',
    updated_at: '2025-03-04T12:00:00Z',
    ...extra.message,
  },
  conversation: { id: 'g1', type: 'group', title: 'Team', ...extra.conversation },
})

const page = (items: SavedMessage[], nextBeforeId: string | null = null): SavedMessagesPage => ({
  data: items,
  meta: { has_more: nextBeforeId !== null, next_before_id: nextBeforeId },
})

const Where = () => {
  const location = useLocation()
  return <output aria-label='Address'>{location.pathname + location.search}</output>
}

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/conversations']}>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

// The list pane it lives in, which takes focus when the list empties.
const renderSaved = () =>
  render(
    <Providers>
      <section id='chat-list' tabIndex={-1} aria-label='Saved messages'>
        <SavedMessages />
      </section>
      <Routes>
        <Route path='*' element={<Where />} />
      </Routes>
      <Toaster />
    </Providers>,
  )

const rows = () => screen.getAllByRole('listitem')

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
  vi.mocked(getSavedMessages).mockReset()
  vi.mocked(unsaveMessage).mockReset()
})

afterEach(() => {
  toast.remove()
})

describe('SavedMessages', () => {
  it('says who said each message, and where, unless the name already does', async () => {
    vi.mocked(getSavedMessages).mockResolvedValue(
      page([
        saved('m1'),
        saved('m2', {
          message: { sender: { id: 'me', name: 'Me' }, body: 'I’ll bring the cables.' },
          conversation: { id: 'd1', type: 'direct', title: 'Bob' },
        }),
        saved('m3', {
          message: { sender: { id: 'bob', name: 'Bob' }, body: 'The code is 4417.' },
          conversation: { id: 'd1', type: 'direct', title: 'Bob' },
        }),
      ]),
    )
    renderSaved()

    const [group, mineInDirect, theirsInDirect] = await screen.findAllByRole('link')
    expect(group).toHaveAccessibleName(/^Sam in Team .*Message m1$/)
    expect(mineInDirect).toHaveAccessibleName(/^You with Bob .*I’ll bring the cables\.$/)
    // Bob's own direct conversation is Bob: no "with Bob" after his name.
    expect(theirsInDirect).toHaveAccessibleName(/^Bob .*The code is 4417\.$/)
    expect(within(theirsInDirect).queryByText(/with/)).not.toBeInTheDocument()
    expect(within(group).getByText(/2025/)).toHaveAttribute('datetime', '2025-03-04T12:00:00Z')
  })

  it('says what an attachment without text is', async () => {
    vi.mocked(getSavedMessages).mockResolvedValue(
      page([
        saved('m1', {
          message: {
            body: '',
            attachments_count: 1,
            attachments: [{ id: 'a1', original_name: 'photo.jpg', is_image: true } as never],
          },
        }),
      ]),
    )
    renderSaved()

    expect(await screen.findByRole('link')).toHaveAccessibleName(/Photo$/)
  })

  it('opens the conversation at the message', async () => {
    const user = userEvent.setup()
    vi.mocked(getSavedMessages).mockResolvedValue(page([saved('m1')]))
    renderSaved()

    await user.click(await screen.findByRole('link', { name: /Message m1/ }))

    expect(screen.getByRole('status', { name: 'Address' })).toHaveTextContent('/conversations/g1?message=m1')
  })

  it('takes a message off the list at once, says so, and keeps the keyboard in the list', async () => {
    const user = userEvent.setup()
    vi.mocked(getSavedMessages).mockResolvedValueOnce(page([saved('m1'), saved('m2'), saved('m3')]))
    // What the server says afterwards.
    vi.mocked(getSavedMessages).mockResolvedValue(page([saved('m1'), saved('m3')]))
    let answer!: () => void
    vi.mocked(unsaveMessage).mockReturnValue(new Promise<void>((resolve) => (answer = resolve)))
    renderSaved()
    await screen.findAllByRole('link')

    const removeSecond = within(rows()[1]).getByRole('button', { name: 'Remove Sam’s message from saved' })
    removeSecond.focus()
    await user.keyboard('{Enter}')

    // Gone before the server has answered.
    await waitFor(() => expect(screen.queryByText('Message m2')).not.toBeInTheDocument())
    expect(unsaveMessage).toHaveBeenCalledWith('m2')
    expect(getSavedMessages).toHaveBeenCalledTimes(1)
    // Onto the row that took its place.
    expect(within(rows()[1]).getByRole('button', { name: /from saved/ })).toHaveFocus()
    expect(within(rows()[1]).getByText('Message m3')).toBeInTheDocument()

    answer()
    expect(await screen.findByText('Removed from saved')).toBeInTheDocument()
  })

  it('puts a message back when it couldn’t be taken off', async () => {
    const user = userEvent.setup()
    vi.mocked(getSavedMessages).mockResolvedValue(page([saved('m1')]))
    vi.mocked(unsaveMessage).mockRejectedValue(new Error('offline'))
    renderSaved()

    await user.click(await screen.findByRole('button', { name: 'Remove Sam’s message from saved' }))

    expect(await screen.findByText('Couldn’t remove it from saved. Please try again.')).toBeInTheDocument()
    expect(await screen.findByText('Message m1')).toBeInTheDocument()
  })

  it('moves to the list itself when the last one goes', async () => {
    const user = userEvent.setup()
    vi.mocked(getSavedMessages).mockResolvedValueOnce(page([saved('m1', { message: { sender: { id: 'me', name: 'Me' } } })]))
    vi.mocked(getSavedMessages).mockResolvedValue(page([]))
    vi.mocked(unsaveMessage).mockResolvedValue(undefined)
    renderSaved()

    await user.click(await screen.findByRole('button', { name: 'Remove your message from saved' }))

    expect(await screen.findByRole('heading', { name: 'No saved messages' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Saved messages' })).toHaveFocus()
  })

  it('says how to save something when nothing is saved', async () => {
    vi.mocked(getSavedMessages).mockResolvedValue(page([]))
    renderSaved()

    expect(await screen.findByRole('heading', { name: 'No saved messages' })).toBeInTheDocument()
    expect(screen.getByText(/Save a message from its menu/)).toBeInTheDocument()
  })

  it('says when the list couldn’t be loaded, and tries again', async () => {
    const user = userEvent.setup()
    vi.mocked(getSavedMessages).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(getSavedMessages).mockResolvedValue(page([saved('m1')]))
    renderSaved()

    expect(await screen.findByRole('heading', { name: 'Couldn’t load your saved messages' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Message m1')).toBeInTheDocument()
  })

  it('shows older saves on request', async () => {
    const user = userEvent.setup()
    vi.mocked(getSavedMessages).mockImplementation(async (beforeId) =>
      beforeId === 's-m2' ? page([saved('m3')]) : page([saved('m1'), saved('m2')], 's-m2'),
    )
    renderSaved()

    await user.click(await screen.findByRole('button', { name: 'Show more' }))

    expect(await screen.findByText('Message m3')).toBeInTheDocument()
    expect(getSavedMessages).toHaveBeenLastCalledWith('s-m2')
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })
})
