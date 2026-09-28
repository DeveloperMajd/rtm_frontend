import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext, type AuthContextType } from '../hooks/useAuth'
import ProfilePage from './ProfilePage'
import SettingsPage from './SettingsPage'
import SettingsLayout from '../layouts/SettingsLayout'
import AppShell from '../layouts/AppShell'
import { changePassword, updateProfile, uploadAvatar } from '../services/api/profile'

vi.mock('../services/api/profile', () => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  changePassword: vi.fn(),
}))
// AppShell's live data: the list, presence and the socket aren't what's
// under test here.
vi.mock('../hooks/useConversations', () => ({ default: () => ({ conversations: [] }) }))
vi.mock('../hooks/usePresenceHeartbeat', () => ({ default: () => {} }))
vi.mock('../hooks/useConnectionStatus', () => ({ default: () => 'connected' }))

const me = { id: 'u1', name: 'Majd Kalthoum', email: 'majd@example.com', bio: 'Backend by day.' }

const httpError = (status: number, data: object = {}) => {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', String(status), config, null, { status, statusText: '', headers: {}, config, data })
}

const auth = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: me,
  isAuthenticated: true,
  isLoading: false,
  sessionExpired: false,
  signedOutByChoice: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(undefined),
  endExpiredSession: vi.fn(),
  ...overrides,
})

const Where = () => {
  const { pathname, hash } = useLocation()
  return <p data-testid='where'>{pathname + hash}</p>
}

const Providers = ({ children, value, at }: { children: ReactNode; value: AuthContextType; at: string }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[at]}>
          {children}
          <Where />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

const renderApp = (at: string, value = auth()) =>
  render(
    <Providers value={value} at={at}>
      <Routes>
        <Route path='/login' element={<p>Sign in page</p>} />
        <Route element={<AppShell />}>
          <Route path='/conversations' element={<p>Chats</p>} />
          <Route element={<SettingsLayout />}>
            <Route path='/profile' element={<ProfilePage />} />
            <Route path='/settings' element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Providers>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.removeAttribute('data-theme')
})

describe('Settings shell', () => {
  it('marks the open page in the settings list, and the avatar in the rail', () => {
    renderApp('/profile')

    const sections = screen.getByRole('navigation', { name: 'Settings sections' })
    expect(within(sections).getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    expect(within(sections).getByRole('link', { name: /Notifications/ })).toHaveTextContent('Soon')
    expect(screen.getByRole('link', { name: 'Profile and settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('goes back to the chat list from the rail', async () => {
    const user = userEvent.setup()
    renderApp('/settings')

    await user.click(screen.getByRole('button', { name: 'Chats' }))

    expect(screen.getByTestId('where')).toHaveTextContent('/conversations')
    expect(screen.getByRole('button', { name: 'Chats' })).toHaveAttribute('aria-current', 'page')
  })

  it('signs out from the foot of the settings list', async () => {
    const user = userEvent.setup()
    const logout = vi.fn().mockResolvedValue(undefined)
    renderApp('/settings', auth({ logout }))

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(logout).toHaveBeenCalled()
  })
})

describe('SettingsPage', () => {
  it('switches the theme from the picker, which the rail’s toggle follows', async () => {
    const user = userEvent.setup()
    renderApp('/settings')

    const picker = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(picker).getByRole('radio', { name: 'System' })).toBeChecked()

    await user.click(within(picker).getByRole('radio', { name: 'Dark' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('rtm.theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /^Theme: Dark/ })).toBeInTheDocument()
  })

  it('shows notification and privacy settings as not live yet, each switch saying how things are today', () => {
    renderApp('/settings')

    const expectations: [RegExp, boolean][] = [
      [/Message sounds/, false],
      [/Desktop notifications/, false],
      [/Read receipts/, false],
      [/Show last seen/, true],
      [/Typing indicators/, true],
    ]
    for (const [name, on] of expectations) {
      const control = screen.getByRole('switch', { name })
      expect(control).toBeDisabled()
      expect(control).toHaveAttribute('aria-checked', String(on))
    }
    expect(screen.getByRole('switch', { name: /Read receipts/ })).toHaveAccessibleName('Read receipts Needs API')
  })

  it('takes focus to a section linked from the settings list', () => {
    renderApp('/settings#privacy')

    expect(screen.getByRole('heading', { name: 'Privacy' })).toHaveFocus()
  })
})

describe('ProfilePage', () => {
  it('won’t save without a name, and says so', async () => {
    const user = userEvent.setup()
    renderApp('/profile')

    await user.clear(screen.getByLabelText('Name'))

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter your name.')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('lets a bio run over the limit to show by how much, but not be saved', async () => {
    const user = userEvent.setup()
    renderApp('/profile')
    const bio = screen.getByLabelText('Bio')

    await user.clear(bio)
    await user.click(bio)
    await user.paste('x'.repeat(503))

    expect(bio).toHaveAccessibleDescription('3 characters over the limit.')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('shows unsaved changes, which Discard puts back', async () => {
    const user = userEvent.setup()
    renderApp('/profile')

    await user.type(screen.getByLabelText('Name'), ' Jr')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Majd Kalthoum')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('saves the trimmed name and bio', async () => {
    const user = userEvent.setup()
    vi.mocked(updateProfile).mockResolvedValue(me)
    renderApp('/profile')

    await user.type(screen.getByLabelText('Name'), '  ')
    await user.type(screen.getByLabelText('Bio'), ' Night owl.')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateProfile).toHaveBeenCalledWith({ name: 'Majd Kalthoum', bio: 'Backend by day. Night owl.' })
  })

  it('keeps the email read-only', () => {
    renderApp('/profile')

    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
  })

  it('explains a photo it can’t take, without uploading it', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderApp('/profile')
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!

    await user.upload(input, new File(['x'], 'party.gif', { type: 'image/gif' }))
    expect(screen.getByRole('alert')).toHaveTextContent('GIF isn’t supported for avatars. Use a JPG, PNG or WebP.')

    const big = new File(['x'], 'harbour.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 7.4 * 1024 * 1024 })
    await user.upload(input, big)
    expect(screen.getByRole('alert')).toHaveTextContent('“harbour.png” is 7.4 MB. Avatars can be up to 5 MB.')

    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('shows a wrong current password on that field', async () => {
    const user = userEvent.setup()
    vi.mocked(changePassword).mockRejectedValue(
      httpError(422, { errors: { current_password: ['Your current password is incorrect.'] } }),
    )
    renderApp('/profile')

    await user.type(screen.getByLabelText('Current password'), 'nope')
    await user.type(screen.getByLabelText('New password'), 'Str0ng_pass')
    await user.type(screen.getByLabelText('Confirm new password'), 'Str0ng_pass')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription(
        'Your current password is incorrect.',
      ),
    )
  })
})
