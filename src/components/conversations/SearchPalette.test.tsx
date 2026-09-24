import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import SearchPalette from './SearchPalette'
import { searchMessages } from '../../services/api/messages'
import type { ConversationType, MessageSearchResultType } from '../../utils/baseTypes'

vi.mock('../../services/api/messages', () => ({
  searchMessages: vi.fn(),
}))

const conversations: ConversationType[] = [
  {
    id: 'c-group',
    type: 'group',
    title: 'Hi justin',
    created_by_user_id: 'me',
    created_at: '2026-09-20T10:00:00Z',
    updated_at: '2026-09-20T10:00:00Z',
    participants: [
      { user_id: 'me', name: 'Me', role: 'admin', is_online: true },
      { user_id: 'n', name: 'nitsuj1001', role: 'participant', is_online: true },
    ],
  },
  {
    id: 'c-direct',
    type: 'direct',
    created_by_user_id: 'me',
    created_at: '2026-09-20T10:00:00Z',
    updated_at: '2026-09-20T10:00:00Z',
    other_participant: { id: 'n', name: 'nitsuj1001', is_online: true },
  },
]

const result = (id: string, conversationId: string, body: string, title: string): MessageSearchResultType => ({
  id,
  conversation_id: conversationId,
  conversation_title: title,
  body,
  sender: { id: 'n', name: 'nitsuj1001' },
  created_at: '2026-09-24T10:02:00Z',
})

const OpenedConversation = () => <p>Opened {useParams().id}</p>

const Harness = ({ onClose = vi.fn() }: { onClose?: () => void }) => {
  const [open, setOpen] = useState(true)
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/conversations']}>
        <div id='root' />
        <Routes>
          <Route path='/conversations' element={null} />
          <Route path='/conversations/:id' element={<OpenedConversation />} />
        </Routes>
        <SearchPalette
          open={open}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          conversations={conversations}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const input = () => screen.getByRole('combobox', { name: 'Search messages' })

beforeEach(() => {
  localStorage.clear()
  vi.mocked(searchMessages).mockReset()
})

describe('SearchPalette', () => {
  it('opens with the field focused, the search scoped Everywhere, and "This conversation" not yet available', () => {
    render(<Harness />)

    expect(input()).toHaveFocus()
    expect(screen.getByRole('button', { name: /Everywhere/ })).toHaveAttribute('aria-pressed', 'true')
    const thisConversation = screen.getByRole('button', { name: 'This conversation (coming soon)' })
    expect(thisConversation).toBeDisabled()
    expect(thisConversation).toHaveTextContent('Soon')
  })

  it('offers recent searches and conversations to jump to before anything is typed', () => {
    localStorage.setItem('rtm.recentSearches', JSON.stringify(['heartbeat ttl']))
    render(<Harness />)

    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('heartbeat ttl'),
      expect.stringContaining('Hi justin'),
      expect.stringContaining('nitsuj1001'),
    ])
    expect(options[1]).toHaveTextContent('2 members')
    expect(options[2]).toHaveTextContent('Online')
    expect(searchMessages).not.toHaveBeenCalled()
  })

  it('opens a conversation from Jump to', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await user.keyboard('{ArrowDown}{Enter}')

    expect(onClose).toHaveBeenCalled()
    expect(screen.getByText('Opened c-direct')).toBeInTheDocument()
  })

  it('groups results by conversation, marks the matching words, and moves through them with the arrow keys', async () => {
    const user = userEvent.setup()
    vi.mocked(searchMessages).mockResolvedValue([
      result('m1', 'c-group', 'Are we still on a 30s TTL for the Redis presence keys?', 'Hi justin'),
      result('m2', 'c-direct', 'Killing Redis on purpose.', 'nitsuj1001'),
      result('m3', 'c-group', 'Redis heartbeats look stable too.', 'Hi justin'),
    ])
    render(<Harness />)

    await user.type(input(), 'redis')

    const groups = await screen.findAllByRole('group', { name: /matches|match/ })
    expect(groups.map((g) => within(g).getAllByRole('option').length)).toEqual([2, 1])
    expect(groups[0]).toHaveAccessibleName(/Hi justin\s*2 matches/)
    expect(searchMessages).toHaveBeenCalledWith('redis')
    expect(screen.getAllByText('Redis', { selector: 'mark' })).toHaveLength(3)
    expect(screen.getByText('3 results')).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(input()).toHaveAttribute('aria-activedescendant', options[0].id)
    await user.keyboard('{ArrowDown}')
    expect(input()).toHaveAttribute('aria-activedescendant', options[1].id)
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the result’s conversation and remembers the search', async () => {
    const user = userEvent.setup()
    vi.mocked(searchMessages).mockResolvedValue([result('m1', 'c-group', 'Redis is up', 'Hi justin')])
    render(<Harness />)

    await user.type(input(), 'redis')
    await screen.findByRole('option')
    await user.keyboard('{Enter}')

    expect(screen.getByText('Opened c-group')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('rtm.recentSearches') ?? '[]')).toEqual(['redis'])
  })

  it('does not search for a single character', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(input(), 'r')
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(searchMessages).not.toHaveBeenCalled()
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    vi.mocked(searchMessages).mockResolvedValue([])
    render(<Harness />)

    await user.type(input(), 'redi5')

    expect(await screen.findByText('No messages match “redi5”')).toBeInTheDocument()
  })

  it('keeps the query when the server can’t be reached, and tries again on request', async () => {
    const user = userEvent.setup()
    vi.mocked(searchMessages)
      .mockRejectedValueOnce(new Error('500'))
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue([result('m1', 'c-group', 'Redis is up', 'Hi justin')])
    render(<Harness />)

    await user.type(input(), 'redis')

    expect(await screen.findByText('Search isn’t available right now', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(input()).toHaveValue('redis')

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByRole('option')).toHaveTextContent('Redis is up'))
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
