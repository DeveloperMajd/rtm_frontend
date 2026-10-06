import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import MessageInfoSheet from './MessageInfoSheet'
import { getMessageInfo, type MessageInfo } from '../../services/api/messages'
import type { MessageType } from '../../utils/baseTypes'

vi.mock('../../services/api/messages', () => ({ getMessageInfo: vi.fn() }))

const message = (overrides: Partial<MessageType> = {}): MessageType => ({
  id: 'm1',
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'me', name: 'Me' },
  body: 'Standup moved to 10:30.',
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  ...overrides,
})

const info = (overrides: Partial<MessageInfo> = {}): MessageInfo => ({
  id: 'm1',
  sender: { id: 'me', name: 'Me' },
  sent_at: '2026-01-01T10:00:00Z',
  edited_at: null,
  deleted_at: null,
  read_by: [],
  not_read: [],
  receipts_hidden: false,
  ...overrides,
})

const person = (name: string) => ({ user_id: name.toLowerCase(), name })

const renderSheet = (props: Partial<ComponentProps<typeof MessageInfoSheet>> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <MessageInfoSheet open onClose={() => {}} message={message()} isOwn {...props} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return { client, ...utils }
}

const seenBy = () => screen.getByRole('region', { name: 'Seen by' })

beforeEach(() => {
  vi.mocked(getMessageInfo).mockReset()
})

describe('MessageInfoSheet', () => {
  it('asks the server only about the viewer’s own message', () => {
    vi.mocked(getMessageInfo).mockResolvedValue(info())

    const { unmount } = renderSheet({ isOwn: false })
    expect(getMessageInfo).not.toHaveBeenCalled()
    unmount()

    renderSheet({ isOwn: true })
    expect(getMessageInfo).toHaveBeenCalledOnce()
    expect(getMessageInfo).toHaveBeenCalledWith('m1')
  })

  it('shows nothing, and asks nothing, while it is closed', () => {
    renderSheet({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(getMessageInfo).not.toHaveBeenCalled()
  })

  it('holds the place of the list while it loads', () => {
    vi.mocked(getMessageInfo).mockReturnValue(new Promise(() => {}))

    renderSheet()

    expect(seenBy()).toHaveAttribute('aria-busy', 'true')
    expect(within(seenBy()).queryByText(/Seen by ·/)).not.toBeInTheDocument()
  })

  it('lists who has seen it, then who has not yet, with how many of how many', async () => {
    vi.mocked(getMessageInfo).mockResolvedValue(
      info({ read_by: [person('Jordan'), person('Sam')], not_read: [person('Robin')] }),
    )

    renderSheet()

    expect(await screen.findByText('Seen by · 2 of 3')).toBeInTheDocument()
    const rows = within(seenBy())
      .getAllByRole('listitem')
      .map((row) => [row.querySelector('.seen-by__name')?.textContent, row.querySelector('.seen-by__status')?.textContent])
    expect(rows).toEqual([
      ['Jordan', 'Seen'],
      ['Sam', 'Seen'],
      ['Robin', 'Not yet'],
    ])
    expect(seenBy()).toHaveAttribute('aria-busy', 'false')
  })

  it('explains that anyone with read receipts off shows as Not yet, only when someone does', async () => {
    vi.mocked(getMessageInfo).mockResolvedValue(info({ read_by: [person('Jordan')], not_read: [person('Sam')] }))
    const { unmount } = renderSheet()
    expect(await screen.findByText('Anyone who has turned off read receipts shows as Not yet.')).toBeInTheDocument()
    unmount()

    vi.mocked(getMessageInfo).mockResolvedValue(info({ read_by: [person('Jordan'), person('Sam')], not_read: [] }))
    renderSheet()
    await screen.findByText('Seen by · 2 of 2')
    expect(screen.queryByText(/turned off read receipts shows/)).not.toBeInTheDocument()
  })

  it('says just “Seen by” in a conversation with one other person', async () => {
    vi.mocked(getMessageInfo).mockResolvedValue(info({ read_by: [], not_read: [person('Jordan')] }))

    renderSheet()

    expect(await screen.findByText('Seen by')).toBeInTheDocument()
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument()
    expect(within(seenBy()).getByText('Not yet')).toBeInTheDocument()
  })

  it('says so when there is no one else to have seen it', async () => {
    vi.mocked(getMessageInfo).mockResolvedValue(info())

    renderSheet()

    expect(await screen.findByText('No one else is in this conversation.')).toBeInTheDocument()
  })

  it('explains why there is no list when the viewer has read receipts off, and links to the setting', async () => {
    vi.mocked(getMessageInfo).mockResolvedValue(info({ read_by: null, not_read: null, receipts_hidden: true }))

    renderSheet()

    expect(await screen.findByText(/You’ve turned off read receipts/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Turn them on in Settings' })).toHaveAttribute('href', '/settings#privacy')
    expect(screen.queryByText(/Seen by ·/)).not.toBeInTheDocument()
  })

  it('does not blame the viewer’s settings when the lists are missing for another reason', async () => {
    vi.mocked(getMessageInfo).mockResolvedValue(info({ read_by: null, not_read: null, receipts_hidden: false }))

    renderSheet()

    expect(await screen.findByText('Who has seen this isn’t available.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('says so when the lists can’t be loaded, and tries again when asked', async () => {
    const user = userEvent.setup()
    vi.mocked(getMessageInfo).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(getMessageInfo).mockResolvedValueOnce(info({ read_by: [person('Jordan')], not_read: [] }))

    renderSheet()

    expect(await screen.findByText('Couldn’t load who has seen this.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Seen by')).toBeInTheDocument()
    expect(within(seenBy()).getByText('Jordan')).toBeInTheDocument()
    expect(screen.queryByText('Couldn’t load who has seen this.')).not.toBeInTheDocument()
  })

  it('keeps the list it already has when a refresh fails', async () => {
    vi.mocked(getMessageInfo).mockResolvedValueOnce(info({ read_by: [person('Jordan')], not_read: [person('Sam')] }))
    const { client } = renderSheet()
    await screen.findByText('Seen by · 1 of 2')

    vi.mocked(getMessageInfo).mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['message-info', 'c1'] })
    })

    expect(screen.getByText('Seen by · 1 of 2')).toBeInTheDocument()
    expect(screen.queryByText('Couldn’t load who has seen this.')).not.toBeInTheDocument()
  })

  it('refreshes the list when its conversation’s message info is invalidated, as a live read does', async () => {
    vi.mocked(getMessageInfo).mockResolvedValueOnce(info({ read_by: [], not_read: [person('Jordan'), person('Sam')] }))
    const { client } = renderSheet()
    await screen.findByText('Seen by · 0 of 2')

    vi.mocked(getMessageInfo).mockResolvedValueOnce(info({ read_by: [person('Jordan')], not_read: [person('Sam')] }))
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['message-info', 'c1'] })
    })

    expect(await screen.findByText('Seen by · 1 of 2')).toBeInTheDocument()
  })

  it('shows the message, who sent it and when', () => {
    vi.mocked(getMessageInfo).mockReturnValue(new Promise(() => {}))

    renderSheet({ isOwn: false, message: message({ sender: { id: 'jordan', name: 'Jordan' }, body: 'Hi there' }) })

    const sheet = screen.getByRole('dialog', { name: 'Message info' })
    expect(within(sheet).getByText('Hi there')).toBeInTheDocument()
    expect(within(sheet).getByText('Jordan')).toBeInTheDocument()
    expect(within(sheet).getByText('Sent')).toBeInTheDocument()
    expect(within(sheet).queryByText('Edited')).not.toBeInTheDocument()
  })

  it('says what a message with no text is made of', () => {
    renderSheet({
      isOwn: false,
      message: message({
        body: '',
        attachments: [
          {
            id: 'a1',
            message_id: 'm1',
            original_name: 'plan.pdf',
            mime_type: 'application/pdf',
            size_bytes: 10,
            is_image: false,
            url: 'https://example.test/plan.pdf',
            created_at: '2026-01-01T10:00:00Z',
          },
        ],
      }),
    })

    expect(within(screen.getByRole('dialog', { name: 'Message info' })).getByText('plan.pdf')).toBeInTheDocument()
  })
})
