import type { ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import MessageItem from './MessageItem'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import { deleteMessage } from '../../services/api/messages'
import type { MessageType } from '../../utils/baseTypes'

vi.mock('../../services/api/messages', () => ({
  deleteMessage: vi.fn(),
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
}))

const authValue: AuthContextType = {
  user: { id: 'me', name: 'Me', email: 'me@example.com' },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
}

const renderItem = (ui: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <ul>{ui}</ul>
        <Toaster />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

const message = (overrides: Partial<MessageType> = {}): MessageType => ({
  id: 'm1',
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'other', name: 'Jordan' },
  body: 'Can you check the queue worker?',
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  ...overrides,
})

const own = (overrides: Partial<MessageType> = {}) =>
  message({ sender: { id: 'me', name: 'Me' }, body: 'Deploying the fix now', ...overrides })

const noop = () => {}

const openMore = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'More actions' }))
  return screen.getByRole('menu', { name: 'Message actions' })
}

const itemNames = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent)

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
  vi.mocked(deleteMessage).mockReset()
})

afterEach(() => {
  toast.remove()
})

describe('MessageItem', () => {
  it("offers Reply, Copy text and React on someone else's message, with the unbuilt actions tagged Soon", async () => {
    const user = userEvent.setup()
    renderItem(<MessageItem message={message()} onReply={noop} onEdit={noop} />)

    const menu = await openMore(user)

    expect(itemNames(menu)).toEqual([
      expect.stringContaining('Reply'),
      expect.stringContaining('Copy text'),
      'React',
      'Message infoSoon',
      'Copy linkSoon',
      'Save messageSoon',
    ])
    for (const name of [/Message info/, /Copy link/, /Save message/]) {
      expect(within(menu).getByRole('menuitem', { name })).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('offers Edit and Delete only on your own message', async () => {
    const user = userEvent.setup()
    renderItem(<MessageItem message={own()} onReply={noop} onEdit={noop} />)

    const menu = await openMore(user)

    expect(itemNames(menu)).toEqual([
      expect.stringContaining('Reply'),
      expect.stringContaining('Copy text'),
      'Edit',
      'Message infoSoon',
      'Delete',
    ])
  })

  it('keeps only Copy text in a read-only group, with React and Reply shown but disabled', async () => {
    const user = userEvent.setup()
    renderItem(
      <MessageItem
        message={message({ reactions: [{ id: 'r1', reaction: '👍', user: { id: 'x', name: 'Sam' } }] })}
        onReply={noop}
        onEdit={noop}
        readOnly
      />,
    )

    expect(screen.getByRole('button', { name: 'Add reaction' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reply' })).toBeDisabled()
    // Reactions stay visible but aren't buttons any more.
    expect(screen.getByRole('img', { name: /Thumbs up, 1/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Thumbs up/ })).not.toBeInTheDocument()

    const menu = await openMore(user)
    expect(itemNames(menu)).toEqual([expect.stringContaining('Copy text')])
  })

  it('shows a deleted message as a placeholder with no toolbar and no reactions', () => {
    renderItem(
      <MessageItem
        message={own({
          body: '',
          deleted_at: '2026-01-01T10:05:00Z',
          reactions: [{ id: 'r1', reaction: '👍', user: { id: 'x', name: 'Sam' } }],
        })}
        onReply={noop}
        onEdit={noop}
        showReadState
      />,
    )

    expect(screen.getByText('This message was deleted')).toBeInTheDocument()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Thumbs up/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Sent')).not.toBeInTheDocument()
  })

  it('replies from the toolbar button and from R anywhere in the toolbar', async () => {
    const user = userEvent.setup()
    const onReply = vi.fn()
    const msg = message()
    renderItem(<MessageItem message={msg} onReply={onReply} onEdit={noop} />)

    await user.click(screen.getByRole('button', { name: 'Reply' }))
    screen.getByRole('button', { name: 'More actions' }).focus()
    await user.keyboard('r')

    expect(onReply).toHaveBeenCalledTimes(2)
    expect(onReply).toHaveBeenLastCalledWith(msg)
  })

  it('is a single tab stop, with the arrow keys moving within the toolbar', async () => {
    const user = userEvent.setup()
    renderItem(<MessageItem message={message()} onReply={noop} onEdit={noop} />)
    const toolbar = screen.getByRole('toolbar', { name: 'Message actions' })

    const tabbable = within(toolbar)
      .getAllByRole('button')
      .filter((b) => b.tabIndex === 0)
    expect(tabbable).toHaveLength(1)

    tabbable[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Reply' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Add reaction' })).toHaveFocus()
  })

  it('hands the message to the composer when Edit is chosen', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const msg = own()
    renderItem(<MessageItem message={msg} onReply={noop} onEdit={onEdit} />)

    const menu = await openMore(user)
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }))

    expect(onEdit).toHaveBeenCalledWith(msg)
  })

  it('asks before deleting, and does nothing if the viewer cancels', async () => {
    const user = userEvent.setup()
    renderItem(<MessageItem message={own()} onReply={noop} onEdit={noop} />)

    const menu = await openMore(user)
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete this message?' })
    expect(dialog).toHaveTextContent('It will show as deleted for everyone in the conversation.')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteMessage).not.toHaveBeenCalled()
  })

  it('deletes once confirmed', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteMessage).mockResolvedValue()
    renderItem(<MessageItem message={own()} onReply={noop} onEdit={noop} />)

    const menu = await openMore(user)
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(deleteMessage).toHaveBeenCalledWith('m1')
  })

  it('says so when a delete fails, and retries from the toast', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteMessage).mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce()
    renderItem(<MessageItem message={own()} onReply={noop} onEdit={noop} />)

    const menu = await openMore(user)
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Couldn’t delete the message')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(deleteMessage).toHaveBeenCalledTimes(2))
  })

  it('copies the message text', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderItem(<MessageItem message={message()} onReply={noop} onEdit={noop} />)

    const menu = await openMore(user)
    await user.click(within(menu).getByRole('menuitem', { name: /Copy text/ }))

    expect(writeText).toHaveBeenCalledWith('Can you check the queue worker?')
    expect(await screen.findByText('Message text copied')).toBeInTheDocument()
  })

  it('disables Copy text for a message with no text', async () => {
    const user = userEvent.setup()
    renderItem(<MessageItem message={message({ body: '', attachments_count: 1 })} onReply={noop} onEdit={noop} />)

    const menu = await openMore(user)

    expect(within(menu).getByRole('menuitem', { name: /Copy text/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows Sent — and only Sent — where asked to carry the delivery state', () => {
    const { rerender } = renderItem(<MessageItem message={own()} onReply={noop} onEdit={noop} showReadState />)
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.queryByText(/Seen/)).not.toBeInTheDocument()

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue}>
          <ul>
            <MessageItem message={own()} onReply={noop} onEdit={noop} />
          </ul>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    expect(screen.queryByText('Sent')).not.toBeInTheDocument()
  })

  it('marks an edited message inside the bubble', () => {
    renderItem(<MessageItem message={own({ edited_at: '2026-01-01T10:02:00Z' })} onReply={noop} onEdit={noop} />)

    expect(screen.getByText('edited')).toBeInTheDocument()
  })

  it.each([
    [
      'your own message, as You',
      { id: 'q', body: 'Are we still on a 30 s TTL?', sender: { id: 'me', name: 'Me' } },
      ['You', 'Are we still on a 30 s TTL?'],
    ],
    [
      'a deleted original',
      { id: 'q', body: '', deleted_at: '2026-01-01T09:00:00Z', sender: { id: 'other', name: 'Jordan' } },
      ['Jordan', 'Original message deleted'],
    ],
    [
      'an attachment-only original',
      { id: 'q', body: '', attachments_count: 2, sender: { id: 'other', name: 'Jordan' } },
      ['Jordan', '2 attachments'],
    ],
  ])('quotes %s', (_label, replyTo, [author, text]) => {
    const { container } = renderItem(
      <MessageItem message={message({ reply_to: replyTo })} onReply={noop} onEdit={noop} />,
    )

    const quote = container.querySelector('.bubble__quote') as HTMLElement
    expect(within(quote).getByText(author)).toBeInTheDocument()
    expect(within(quote).getByText(text)).toBeInTheDocument()
  })
})
