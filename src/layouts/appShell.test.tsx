import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ConnectionStatus } from 'laravel-echo'
import { AuthContext, type AuthContextType } from '../hooks/useAuth'
import AppShell from './AppShell'
import ConversationsLayout from './ConversationsLayout'
import SettingsLayout from './SettingsLayout'
import SettingsHome from '../components/settings/SettingsHome'
import SettingsPage from '../pages/SettingsPage'
import type { ConversationType } from '../utils/baseTypes'

const conversations = [
  { id: 'c1', type: 'direct', unread_count: 2, other_participant: { id: 'u2', name: 'Sam Okafor' } },
  { id: 'c2', type: 'group', title: 'Weekend hike', unread_count: 3 },
  // Left: whatever it says, nothing there is waiting for the viewer.
  { id: 'c3', type: 'group', title: 'Old team', unread_count: 4, viewer_left_at: '2026-09-01T10:00:00Z' },
] as ConversationType[]

let connection: ConnectionStatus = 'connected'

vi.mock('../hooks/useConversations', () => ({
  default: () => ({ conversations, isLoading: false, error: null, isReady: true }),
}))
vi.mock('../hooks/usePresenceHeartbeat', () => ({ default: () => {} }))
vi.mock('../hooks/useConnectionStatus', () => ({ default: () => connection }))
vi.mock('../services/api/contacts', () => ({
  getContacts: vi.fn().mockResolvedValue([]),
  searchUsers: vi.fn().mockResolvedValue([]),
  addContact: vi.fn(),
  removeContact: vi.fn(),
}))

const me = { id: 'u1', name: 'Majd Kalthoum', email: 'majd@example.com', bio: 'Backend by day.' }

const auth: AuthContextType = {
  user: me,
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

const Providers = ({ children, at }: { children: ReactNode; at: string }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[at]}>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

const renderAt = (at: string) =>
  render(
    <Providers at={at}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path='/conversations' element={<ConversationsLayout />}>
            <Route path=':id' element={<p>The room</p>} />
          </Route>
          <Route element={<SettingsLayout />}>
            <Route path='/me' element={<SettingsHome />} />
            <Route path='/profile' element={<p>Profile page</p>} />
            <Route path='/settings' element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Providers>,
  )

const shell = () => document.querySelector('.app-shell') as HTMLElement

beforeEach(() => {
  connection = 'connected'
})

describe('AppShell on every screen size', () => {
  it.each([
    ['/conversations', 'list'],
    ['/conversations/c1', 'room'],
    ['/me', 'settings-hub'],
    ['/settings', 'settings'],
    ['/profile', 'settings'],
  ])('tells the stylesheet which screen %s is', (at, view) => {
    renderAt(at)

    expect(shell()).toHaveAttribute('data-view', view)
  })

  it('counts what’s unread in the Chats button, leaving out groups the viewer has left', () => {
    renderAt('/conversations')

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const chats = within(nav).getByRole('button', { name: 'Chats, 5 unread' })
    expect(chats).toHaveAttribute('aria-current', 'page')
    // The tab bar's badge (the rail shows a dot instead).
    expect(chats.querySelector('.rail__count')).toHaveTextContent('5')
  })

  it('takes the tab bar’s Profile to the settings list, and the rail’s avatar to the profile page', () => {
    renderAt('/conversations')

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/me')
    expect(screen.getByRole('link', { name: 'Profile and settings' })).toHaveAttribute('href', '/profile')
  })

  it('switches the list to Contacts from the navigation', async () => {
    const user = userEvent.setup()
    renderAt('/conversations')

    await user.click(screen.getByRole('button', { name: 'Contacts' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Contacts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Contacts' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('the Chats screen', () => {
  it('says the connection is live beside the title', () => {
    renderAt('/conversations')

    expect(document.querySelector('.list-pane__live')).toHaveTextContent('Live')
  })

  it('says so when it isn’t', () => {
    vi.useFakeTimers()
    try {
      connection = 'reconnecting'
      renderAt('/conversations')
      // Held back briefly, so a quick blip never shows.
      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(document.querySelector('.list-pane__live')).toHaveTextContent('Reconnecting')
      expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…')
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers both ways to start a conversation from a phone’s New conversation button', async () => {
    const user = userEvent.setup()
    renderAt('/conversations')

    await user.click(screen.getByRole('button', { name: 'New conversation' }))
    const sheet = screen.getByRole('dialog', { name: 'New conversation' })
    await user.click(within(sheet).getByRole('button', { name: /Add contact/ }))

    expect(screen.queryByRole('dialog', { name: 'New conversation' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Add contact' })).toBeInTheDocument()
  })

  it('opens New group from the same sheet', async () => {
    const user = userEvent.setup()
    renderAt('/conversations')

    await user.click(screen.getByRole('button', { name: 'New conversation' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /New group/ }))

    expect(screen.getByRole('dialog', { name: 'New group' })).toBeInTheDocument()
  })
})

describe('the settings list (/me)', () => {
  it('shows who’s signed in above the sections, with nothing chosen yet', () => {
    renderAt('/me')

    expect(screen.getByText('Majd Kalthoum')).toBeInTheDocument()
    expect(screen.getByText('majd@example.com')).toBeInTheDocument()
    expect(screen.getByText('Backend by day.')).toBeInTheDocument()
    const sections = screen.getByRole('navigation', { name: 'Settings sections' })
    expect(within(sections).queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
    expect(screen.getByText('Choose a section to see its settings.')).toBeInTheDocument()
    const primary = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(primary).getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
  })

  it('leads from a settings page back to the list', () => {
    renderAt('/settings')

    expect(screen.getByRole('link', { name: 'Back to settings' })).toHaveAttribute('href', '/me')
  })
})
