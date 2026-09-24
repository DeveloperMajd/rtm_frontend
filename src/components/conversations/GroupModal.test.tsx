import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import GroupModal from './GroupModal'
import { createConversation } from '../../services/api/conversations'
import { getContacts } from '../../services/api/contacts'

vi.mock('../../services/api/conversations', () => ({ createConversation: vi.fn() }))
vi.mock('../../services/api/contacts', () => ({ getContacts: vi.fn() }))

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const renderModal = (props: Partial<Parameters<typeof GroupModal>[0]> = {}) =>
  render(
    <Providers>
      <GroupModal open onClose={vi.fn()} {...props} />
    </Providers>,
  )

const checkboxFor = (name: string) =>
  screen.getByText(name, { exact: true, selector: '.person-row__name' }).closest('label')!.querySelector('input')!

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getContacts).mockResolvedValue([
    { id: 'n', name: 'nitsuj1001', is_online: true },
    { id: 'k', name: 'Kal', is_online: false },
  ])
})

describe('GroupModal', () => {
  it('can’t create a group until someone is picked', async () => {
    const user = userEvent.setup()
    renderModal()
    await screen.findByText('Kal')

    const create = screen.getByRole('button', { name: 'Create group' })
    expect(create).toBeDisabled()

    await user.click(checkboxFor('Kal'))
    expect(create).toBeEnabled()
  })

  it('leaves the name optional and sends who was picked', async () => {
    const user = userEvent.setup()
    vi.mocked(createConversation).mockResolvedValue({ data: { id: 'new' } } as never)
    renderModal()
    await screen.findByText('Kal')

    await user.click(checkboxFor('nitsuj1001'))
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    expect(vi.mocked(createConversation).mock.calls[0][0]).toEqual({
      type: 'group',
      title: undefined,
      participant_ids: ['n'],
    })
  })

  it('sends a trimmed name when one is given', async () => {
    const user = userEvent.setup()
    vi.mocked(createConversation).mockResolvedValue({ data: { id: 'new' } } as never)
    renderModal()
    await screen.findByText('Kal')

    await user.type(screen.getByRole('textbox', { name: 'Group name' }), '  Weekend plans  ')
    await user.click(checkboxFor('Kal'))
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    expect(vi.mocked(createConversation).mock.calls[0][0]).toMatchObject({ title: 'Weekend plans' })
  })

  it('shows who’s in as chips that can be removed again', async () => {
    const user = userEvent.setup()
    renderModal()
    await screen.findByText('Kal')

    await user.click(checkboxFor('Kal'))
    const chips = screen.getByRole('list', { name: 'Selected people' })
    expect(within(chips).getByText('Kal')).toBeInTheDocument()
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    await user.click(within(chips).getByRole('button', { name: 'Remove Kal' }))
    expect(checkboxFor('Kal')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Create group' })).toBeDisabled()
  })

  it('offers to add a contact when there are none to pick from', async () => {
    const user = userEvent.setup()
    const onAddContact = vi.fn()
    const onClose = vi.fn()
    vi.mocked(getContacts).mockResolvedValue([])
    renderModal({ onAddContact, onClose })

    await user.click(await screen.findByRole('button', { name: /Add contact/ }))

    expect(onClose).toHaveBeenCalled()
    expect(onAddContact).toHaveBeenCalled()
  })

  it('locks the form while the group is being created', async () => {
    const user = userEvent.setup()
    vi.mocked(createConversation).mockReturnValue(new Promise(() => {}))
    renderModal()
    await screen.findByText('Kal')

    await user.click(checkboxFor('Kal'))
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Group name' })).toBeDisabled())
    expect(checkboxFor('nitsuj1001')).toBeDisabled()
  })
})
