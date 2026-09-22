import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Conversations from './Conversations'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import type { ConversationType } from '../../utils/baseTypes'

const authValue: AuthContextType = {
  user: { id: 'me', name: 'Me', email: 'me@example.com' },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
}

const renderWithProviders = (ui: ReactNode) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  )

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
    expect(screen.getByText('No unread conversations.')).toBeInTheDocument()
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

    rerender(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <Conversations conversations={list} isLoading={false} error={null} filter='direct' />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Direct chat')).toBeInTheDocument()
    expect(screen.queryByText('Group chat')).not.toBeInTheDocument()
  })

  it('shows a filter-specific empty message rather than the generic one', () => {
    renderWithProviders(<Conversations conversations={[]} isLoading={false} error={null} filter='groups' />)
    expect(screen.getByText('No group conversations.')).toBeInTheDocument()
  })

  it('renders disabled, labelled Pin/Mute/Archive actions as siblings of the link, not nested inside it', () => {
    const list = [conversation({ id: 'c1' })]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} />)

    const link = screen.getByRole('link')
    // Nesting a <button> inside an <a> is invalid HTML — these must be siblings.
    expect(within(link).queryAllByRole('button')).toHaveLength(0)

    for (const label of ['Pin conversation (coming soon)', 'Mute conversation (coming soon)', 'Archive conversation (coming soon)']) {
      const button = screen.getByRole('button', { name: label })
      expect(button).toBeDisabled()
    }
  })

  it('does not render quick actions on a row for a conversation the viewer has left', () => {
    const list = [
      conversation({
        id: 'left',
        type: 'group',
        title: 'Left group',
        viewer_left_at: '2026-01-01T00:00:00Z',
      }),
    ]
    renderWithProviders(<Conversations conversations={list} isLoading={false} error={null} />)
    expect(screen.queryByRole('button', { name: 'Pin conversation (coming soon)' })).not.toBeInTheDocument()
  })
})
