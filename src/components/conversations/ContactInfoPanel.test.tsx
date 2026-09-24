import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ContactInfoPanel from './ContactInfoPanel'
import { removeContact } from '../../services/api/contacts'
import type { ContactType, ConversationType } from '../../utils/baseTypes'

let mockContacts: ContactType[] = []
vi.mock('../../services/api/contacts', () => ({ removeContact: vi.fn() }))
vi.mock('../../hooks/useContacts', () => ({ default: () => ({ data: mockContacts }) }))

const direct: ConversationType = {
  id: 'dm-n',
  type: 'direct',
  created_by_user_id: 'me',
  created_at: '2026-09-14T10:00:00Z',
  updated_at: '2026-09-14T10:00:00Z',
  other_participant: { id: 'n', name: 'nitsuj1001', is_online: true },
}

const groupWith = (id: string, title: string, members: { user_id: string; left_at?: string }[], viewerLeft = false) =>
  ({
    id,
    type: 'group',
    title,
    created_by_user_id: 'me',
    created_at: '2026-09-15T10:00:00Z',
    updated_at: '2026-09-15T10:00:00Z',
    viewer_left_at: viewerLeft ? '2026-09-20T10:00:00Z' : null,
    participants: members.map((m) => ({ name: m.user_id, role: 'participant', is_online: false, ...m })),
  }) as ConversationType

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const renderPanel = (conversations: ConversationType[] = [direct]) =>
  render(
    <Providers>
      <ContactInfoPanel conversation={direct} conversations={conversations} />
    </Providers>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockContacts = [{ id: 'n', name: 'nitsuj1001' }]
})

describe('ContactInfoPanel', () => {
  it('shows who this is and since when you’ve been talking', () => {
    renderPanel()

    expect(screen.getByText('nitsuj1001')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Direct · since 14 Sep 2026')).toBeInTheDocument()
  })

  it('lists only the groups you’re both still in', () => {
    renderPanel([
      direct,
      groupWith('g1', 'Hi justin', [{ user_id: 'me' }, { user_id: 'n' }]),
      groupWith('g2', 'They left', [{ user_id: 'me' }, { user_id: 'n', left_at: '2026-09-19T10:00:00Z' }]),
      groupWith('g3', 'You left', [{ user_id: 'me' }, { user_id: 'n' }], true),
      groupWith('g4', 'Not theirs', [{ user_id: 'me' }]),
    ])

    const shared = screen.getByText('Shared groups').nextElementSibling as HTMLElement
    expect(within(shared).getAllByRole('link').map((a) => a.textContent)).toEqual(['Hi justin'])
  })

  it('offers removing them only if they’re a contact, and asks first', async () => {
    const user = userEvent.setup()
    vi.mocked(removeContact).mockResolvedValue()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Remove from contacts/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Remove nitsuj1001?' })).getByRole('button', { name: 'Remove' }))

    expect(removeContact).toHaveBeenCalledWith('n')
  })

  it('has nothing to remove when they aren’t a contact', () => {
    mockContacts = []
    renderPanel()

    expect(screen.queryByRole('button', { name: /Remove from contacts/ })).not.toBeInTheDocument()
  })

  it('shows search, mute and pin as coming, not as working', () => {
    renderPanel()

    for (const label of ['Search', 'Mute', 'Pin']) {
      expect(screen.getByRole('button', { name: `${label} (coming soon)` })).toBeDisabled()
    }
  })
})
