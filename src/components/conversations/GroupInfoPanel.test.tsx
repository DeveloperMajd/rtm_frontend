import { useState, type ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import GroupInfoPanel from './GroupInfoPanel'
import {
  addParticipant,
  deleteConversation,
  kickParticipant,
  leaveConversation,
  renameConversation,
  updateParticipantRole,
} from '../../services/api/conversations'
import { getContacts } from '../../services/api/contacts'
import type { ConversationType } from '../../utils/baseTypes'

vi.mock('../../services/api/conversations', () => ({
  addParticipant: vi.fn(),
  deleteConversation: vi.fn(),
  kickParticipant: vi.fn(),
  leaveConversation: vi.fn(),
  renameConversation: vi.fn(),
  updateParticipantRole: vi.fn(),
}))
vi.mock('../../services/api/contacts', () => ({ getContacts: vi.fn() }))

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
  vi.clearAllMocks()
  vi.mocked(getContacts).mockResolvedValue([])
})

type P = NonNullable<ConversationType['participants']>[number]
const person = (user_id: string, name: string, role = 'participant', extra: Partial<P> = {}): P => ({
  user_id,
  name,
  role,
  is_online: false,
  ...extra,
})

const group = (participants: P[], title: string | undefined = 'Hi justin'): ConversationType => ({
  id: 'g1',
  type: 'group',
  title,
  created_by_user_id: 'me',
  created_at: '2026-09-18T10:00:00Z',
  updated_at: '2026-09-18T10:00:00Z',
  participants,
})

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        {children}
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const renderPanel = (conversation: ConversationType, { readOnly = false } = {}) =>
  render(
    <Providers>
      <GroupInfoPanel conversation={conversation} currentUserId='me' readOnly={readOnly} />
    </Providers>,
  )

/** The checkbox on the row whose name is exactly `name`. */
const checkboxFor = (container: HTMLElement, name: string) =>
  within(container).getByText(name, { exact: true, selector: '.person-row__name' }).closest('label')!.querySelector('input')!

const openMemberMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name: `Manage ${name}` }))
  return screen.getByRole('menu', { name: `Manage ${name}` })
}

describe('GroupInfoPanel — what each role sees', () => {
  it('gives an admin the rename field, Add people, a menu on every other member, and Delete group', () => {
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001'), person('k', 'Kal')]))

    expect(screen.getByRole('textbox', { name: 'Group name' })).toHaveValue('Hi justin')
    expect(screen.getByRole('button', { name: /Add people/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Manage nitsuj1001' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Manage Me' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete group/ })).toBeInTheDocument()
  })

  it('shows a participant the members and Leave, and says what only admins can do', () => {
    renderPanel(group([person('me', 'Me'), person('n', 'nitsuj1001', 'admin')]))

    expect(screen.getByText('Only admins can rename the group or add and remove people.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Group name' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Manage / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete group/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Leave group/ })).toBeInTheDocument()
  })

  it('offers nothing to change once the viewer is no longer a member', () => {
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001')]), { readOnly: true })

    expect(screen.getByText('nitsuj1001')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Group name' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Leave group|Delete group|Manage/ })).not.toBeInTheDocument()
  })

  it('marks admins and the viewer, and counts who is online', () => {
    renderPanel(group([person('me', 'Me', 'admin', { is_online: true }), person('n', 'nitsuj1001')]))

    expect(screen.getByText('2 members · 1 online')).toBeInTheDocument()
    expect(screen.getByText('You · Online')).toBeInTheDocument()
    expect(screen.getAllByText('Admin')).toHaveLength(1)
  })

  it('shows shared media as not yet available', () => {
    renderPanel(group([person('me', 'Me'), person('n', 'nitsuj1001', 'admin')]))
    expect(screen.getByText('Shared media').closest('.info-row')).toHaveTextContent('Needs API')
  })
})

describe('GroupInfoPanel — admin actions', () => {
  it('renames the group only when the name actually changed', async () => {
    const user = userEvent.setup()
    vi.mocked(renameConversation).mockResolvedValue({ data: group([]) })
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001')]))

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()

    const field = screen.getByRole('textbox', { name: 'Group name' })
    await user.clear(field)
    await user.type(field, 'Weekend plans')
    await user.click(save)

    expect(renameConversation).toHaveBeenCalledWith('g1', 'Weekend plans')
  })

  it('makes a member an admin from their menu', async () => {
    const user = userEvent.setup()
    vi.mocked(updateParticipantRole).mockResolvedValue()
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001')]))

    const menu = await openMemberMenu(user, 'nitsuj1001')
    await user.click(within(menu).getByRole('menuitem', { name: 'Make admin' }))

    expect(updateParticipantRole).toHaveBeenCalledWith('g1', 'n', 'admin')
  })

  it('shows the server’s own reason when a role change is refused', async () => {
    const user = userEvent.setup()
    vi.mocked(updateParticipantRole).mockRejectedValue({
      response: { data: { data: { message: 'A group needs at least one admin.' } } },
    })
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001', 'admin')]))

    const menu = await openMemberMenu(user, 'nitsuj1001')
    await user.click(within(menu).getByRole('menuitem', { name: 'Remove admin' }))

    expect(await screen.findByText('A group needs at least one admin.')).toBeInTheDocument()
  })

  it('asks before removing a member, then removes them', async () => {
    const user = userEvent.setup()
    vi.mocked(kickParticipant).mockResolvedValue()
    renderPanel(group([person('me', 'Me', 'admin'), person('r', 'Redis Outage Test')]))

    const menu = await openMemberMenu(user, 'Redis Outage Test')
    await user.click(within(menu).getByRole('menuitem', { name: 'Remove from group' }))

    const dialog = screen.getByRole('dialog', { name: 'Remove Redis Outage Test?' })
    expect(dialog).toHaveTextContent('Everyone will see a note that they were removed.')
    expect(kickParticipant).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(kickParticipant).toHaveBeenCalledWith('g1', 'r')
  })

  it('adds the chosen contacts who aren’t in the group yet, one request each', async () => {
    const user = userEvent.setup()
    vi.mocked(getContacts).mockResolvedValue([
      { id: 'n', name: 'nitsuj1001' },
      { id: 'k', name: 'Kal' },
      { id: 'm', name: 'Majd Kalthoum' },
    ])
    vi.mocked(addParticipant).mockResolvedValue()
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001')]))

    await user.click(screen.getByRole('button', { name: /Add people/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Add people to Hi justin' })
    // Already a member: not offered.
    expect(within(dialog).queryByText('nitsuj1001')).not.toBeInTheDocument()

    await within(dialog).findByText('Kal', { exact: true })
    await user.click(checkboxFor(dialog, 'Kal'))
    await user.click(checkboxFor(dialog, 'Majd Kalthoum'))
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 people' }))

    await waitFor(() => expect(addParticipant).toHaveBeenCalledTimes(2))
    expect(addParticipant).toHaveBeenCalledWith('g1', 'k')
    expect(addParticipant).toHaveBeenCalledWith('g1', 'm')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps whoever couldn’t be added selected, so trying again only retries them', async () => {
    const user = userEvent.setup()
    vi.mocked(getContacts).mockResolvedValue([
      { id: 'k', name: 'Kal' },
      { id: 'm', name: 'Majd Kalthoum' },
    ])
    vi.mocked(addParticipant).mockImplementation(async (_g, userId) => {
      if (userId === 'm') throw new Error('500')
    })
    renderPanel(group([person('me', 'Me', 'admin')]))

    await user.click(screen.getByRole('button', { name: /Add people/ }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Kal', { exact: true })
    await user.click(checkboxFor(dialog, 'Kal'))
    await user.click(checkboxFor(dialog, 'Majd Kalthoum'))
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 people' }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Add 1 person' })).toBeInTheDocument())
    expect(checkboxFor(dialog, 'Majd Kalthoum')).toBeChecked()
    expect(checkboxFor(dialog, 'Kal')).not.toBeChecked()
  })

  it('deletes a named group only once its name is typed (any case)', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteConversation).mockResolvedValue()
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001')]))

    await user.click(screen.getByRole('button', { name: /Delete group/ }))
    const dialog = screen.getByRole('dialog', { name: 'Delete “Hi justin”?' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete group' })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByLabelText('Type the group name to confirm'), 'hi JUSTIN')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    expect(deleteConversation).toHaveBeenCalledWith('g1')
  })

  it('deletes an untitled group on confirmation alone — there is no name to type', async () => {
    const user = userEvent.setup()
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001')], ''))

    await user.click(screen.getByRole('button', { name: /Delete group/ }))
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete group' })).toBeEnabled()
  })
})

describe('GroupInfoPanel — leaving', () => {
  it('asks first, and staying does nothing', async () => {
    const user = userEvent.setup()
    renderPanel(group([person('me', 'Me'), person('n', 'nitsuj1001', 'admin')]))

    await user.click(screen.getByRole('button', { name: /Leave group/ }))
    const dialog = screen.getByRole('dialog', { name: 'Leave “Hi justin”?' })
    expect(dialog).toHaveTextContent('won’t be able to send messages or react')

    await user.click(within(dialog).getByRole('button', { name: 'Stay' }))
    expect(leaveConversation).not.toHaveBeenCalled()
  })

  it('leaves once confirmed', async () => {
    const user = userEvent.setup()
    vi.mocked(leaveConversation).mockResolvedValue()
    renderPanel(group([person('me', 'Me'), person('n', 'nitsuj1001', 'admin')]))

    await user.click(screen.getByRole('button', { name: /Leave group/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Leave group' }))

    expect(leaveConversation).toHaveBeenCalledWith('g1', 'me')
  })

  it('warns the last member that there is no way back in', async () => {
    const user = userEvent.setup()
    renderPanel(group([person('me', 'Me', 'admin')]))

    await user.click(screen.getByRole('button', { name: /Leave group/ }))

    const dialog = screen.getByRole('dialog', { name: 'Leave group?' })
    expect(dialog).toHaveTextContent('You’re the only member left')
    expect(within(dialog).getByRole('button', { name: 'Leave anyway' })).toBeInTheDocument()
  })

  it('has the only admin hand over first: pick a successor, who is made admin before the viewer leaves', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    vi.mocked(updateParticipantRole).mockImplementation(async (_g, userId, role) => {
      calls.push(`role:${userId}:${role}`)
    })
    vi.mocked(leaveConversation).mockImplementation(async () => {
      calls.push('leave')
    })
    renderPanel(group([person('me', 'Me', 'admin'), person('n', 'nitsuj1001'), person('k', 'Kal')]))

    expect(screen.getByText(/You’re the only admin/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Leave group/ }))

    const dialog = screen.getByRole('dialog', { name: 'Choose a new admin first' })
    const confirm = within(dialog).getByRole('button', { name: 'Make admin and leave' })
    expect(confirm).toBeDisabled()

    await user.click(within(dialog).getByText('Kal', { exact: true }).closest('label')!.querySelector('input')!)
    await user.click(confirm)

    await waitFor(() => expect(calls).toEqual(['role:k:admin', 'leave']))
  })
})
