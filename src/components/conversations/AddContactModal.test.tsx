import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddContactModal from './AddContactModal'
import { addContact, searchUsers } from '../../services/api/contacts'

vi.mock('../../services/api/contacts', () => ({ addContact: vi.fn(), searchUsers: vi.fn() }))

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const renderModal = (onAdded = vi.fn()) =>
  render(
    <Providers>
      <AddContactModal open onClose={vi.fn()} onAdded={onAdded} />
    </Providers>,
  )

const field = () => screen.getByRole('searchbox', { name: 'Name or email' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AddContactModal', () => {
  it('waits for 2 characters before searching', async () => {
    const user = userEvent.setup()
    renderModal()

    expect(field()).toHaveFocus()
    expect(screen.getByText('Type at least 2 characters.')).toBeInTheDocument()
    await user.type(field(), 'j')
    await new Promise((r) => setTimeout(r, 400))

    expect(searchUsers).not.toHaveBeenCalled()
  })

  it('lists who it finds with their presence, and adds one — opening the new conversation', async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    vi.mocked(searchUsers).mockResolvedValue([{ id: 'n', name: 'nitsuj1001', is_online: true }])
    vi.mocked(addContact).mockResolvedValue({
      contact: { id: 'n', name: 'nitsuj1001' },
      conversation: { id: 'dm-1' } as never,
    })
    renderModal(onAdded)

    await user.type(field(), 'nits')
    expect(await screen.findByText('nitsuj1001')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add nitsuj1001' }))

    expect(addContact).toHaveBeenCalledWith('n')
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('dm-1'))
  })

  it('says when no one matches', async () => {
    const user = userEvent.setup()
    vi.mocked(searchUsers).mockResolvedValue([])
    renderModal()

    await user.type(field(), 'zzqa')

    expect(await screen.findByText('No one found for “zzqa”')).toBeInTheDocument()
  })

  it('keeps the search when the server can’t be reached, and tries again on request', async () => {
    const user = userEvent.setup()
    vi.mocked(searchUsers)
      .mockRejectedValueOnce(new Error('500'))
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue([{ id: 'n', name: 'nitsuj1001' }])
    renderModal()

    await user.type(field(), 'nits')

    expect(await screen.findByText('Couldn’t search right now', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(field()).toHaveValue('nits')

    await user.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText('nitsuj1001')).toBeInTheDocument()
  })
})
