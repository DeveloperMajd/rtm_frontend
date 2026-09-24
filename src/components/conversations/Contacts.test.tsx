import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import Contacts from './Contacts'
import { removeContact } from '../../services/api/contacts'
import type { ContactType, ConversationType } from '../../utils/baseTypes'

const contacts: ContactType[] = [
  { id: 'n', name: 'nitsuj1001', is_online: true },
  { id: 'k', name: 'Kal', is_online: false, last_seen_at: null },
]

vi.mock('../../services/api/contacts', () => ({ removeContact: vi.fn() }))
// useConversations subscribes to Echo; the list only needs the data.
vi.mock('../../hooks/useConversations', () => ({
  default: () => ({
    conversations: [
      { id: 'dm-n', type: 'direct', other_participant: { id: 'n', name: 'nitsuj1001', is_online: true } },
    ] as ConversationType[],
  }),
}))
vi.mock('../../hooks/useContacts', () => ({
  default: () => ({ data: contacts, isLoading: false, error: null }),
}))

const Opened = () => <p>Opened {useParams().id}</p>

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/conversations']}>
        <Routes>
          <Route path='/conversations' element={children} />
          <Route path='/conversations/:id' element={<Opened />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const renderContacts = (props: Partial<Parameters<typeof Contacts>[0]> = {}) =>
  render(
    <Providers>
      <Contacts onConversationOpened={vi.fn()} onAddContact={vi.fn()} {...props} />
    </Providers>,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Contacts', () => {
  it('lists contacts with their presence and a count at the foot', () => {
    renderContacts()

    expect(screen.getByText('nitsuj1001')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText('2 contacts · 1 online')).toBeInTheDocument()
  })

  it('filters by name', async () => {
    const user = userEvent.setup()
    renderContacts()

    await user.type(screen.getByRole('searchbox', { name: 'Search contacts' }), 'ka')

    expect(screen.getByText('Kal')).toBeInTheDocument()
    expect(screen.queryByText('nitsuj1001')).not.toBeInTheDocument()
  })

  it('opens the conversation with a contact, as it always has', async () => {
    const user = userEvent.setup()
    const onConversationOpened = vi.fn()
    renderContacts({ onConversationOpened })

    await user.click(screen.getByText('nitsuj1001'))

    expect(screen.getByText('Opened dm-n')).toBeInTheDocument()
    expect(onConversationOpened).toHaveBeenCalled()
  })

  it('asks before removing a contact', async () => {
    const user = userEvent.setup()
    vi.mocked(removeContact).mockResolvedValue()
    renderContacts()

    await user.click(screen.getByRole('button', { name: 'Remove Kal from contacts' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove Kal?' })
    expect(dialog).toHaveTextContent('Your conversation and its history stay.')
    expect(removeContact).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(removeContact).toHaveBeenCalledWith('k')
  })

  it('opens the Add contact dialog through the shell', async () => {
    const user = userEvent.setup()
    const onAddContact = vi.fn()
    renderContacts({ onAddContact })

    await user.click(screen.getByRole('button', { name: /Add contact/ }))
    expect(onAddContact).toHaveBeenCalled()
  })
})
