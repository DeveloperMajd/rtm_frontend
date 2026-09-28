import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import useAuth from '../hooks/useAuth'
import RequireAuth from '../layouts/RequireAuth'
import LoginPage from '../pages/LoginPage'
import * as authApi from '../services/api/auth'
import { notifySessionExpired } from '../services/api/sessionEvents'
import { saveDraft } from '../utils/drafts'
import type { ConversationType } from '../utils/baseTypes'

vi.mock('../services/api/auth', () => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  oauthRedirectUrl: () => '/oauth',
}))
vi.mock('../services/api/presence', () => ({ leave: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../services/api/csrf', () => ({ primeCsrf: vi.fn().mockResolvedValue(undefined) }))

const me = { id: 'u1', name: 'Majd', email: 'majd@example.com' }

const httpError = (status: number) => {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', String(status), config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: {},
  })
}

const Providers = ({ children, client }: { children: ReactNode; client?: QueryClient }) => {
  const [queryClient] = useState(() => client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

const Probe = () => {
  const { user, sessionExpired, logout } = useAuth()
  const [failed, setFailed] = useState(false)
  return (
    <>
      <p>user: {user?.name ?? 'none'}</p>
      <p>expired: {String(sessionExpired)}</p>
      {failed && <p>sign out failed</p>}
      <button onClick={() => logout().catch(() => setFailed(true))}>Sign out</button>
    </>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuthProvider', () => {
  it('marks the session expired when a request 401s while signed in', async () => {
    vi.mocked(authApi.me).mockResolvedValue(me)
    render(
      <Providers>
        <Probe />
      </Providers>,
    )
    await screen.findByText('user: Majd')

    act(() => notifySessionExpired())

    expect(screen.getByText('expired: true')).toBeInTheDocument()
    // Still signed in underneath — nothing on screen is torn down yet.
    expect(screen.getByText('user: Majd')).toBeInTheDocument()
  })

  it('ignores a 401 while signed out', async () => {
    vi.mocked(authApi.me).mockRejectedValue(httpError(401))
    render(
      <Providers>
        <Probe />
      </Providers>,
    )
    await screen.findByText('user: none')

    act(() => notifySessionExpired())

    expect(screen.getByText('expired: false')).toBeInTheDocument()
  })

  it('signing out forgets this user’s drafts', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(me)
    vi.mocked(authApi.logout).mockResolvedValue()
    saveDraft('u1', 'c1', 'private note')
    render(
      <Providers>
        <Probe />
      </Providers>,
    )
    await screen.findByText('user: Majd')

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByText('user: none')).toBeInTheDocument()
    expect(localStorage.getItem('rtm.draft.u1.c1')).toBeNull()
  })

  it('treats a sign out whose session had already ended as signed out, without flagging it expired', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(me)
    vi.mocked(authApi.logout).mockImplementation(async () => {
      notifySessionExpired()
      throw httpError(401)
    })
    render(
      <Providers>
        <Probe />
      </Providers>,
    )
    await screen.findByText('user: Majd')

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByText('user: none')).toBeInTheDocument()
    expect(screen.getByText('expired: false')).toBeInTheDocument()
  })

  it('stays signed in when the sign out request itself fails', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(me)
    vi.mocked(authApi.logout).mockRejectedValue(httpError(500))
    render(
      <Providers>
        <Probe />
      </Providers>,
    )
    await screen.findByText('user: Majd')

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByText('sign out failed')).toBeInTheDocument()
    expect(screen.getByText('user: Majd')).toBeInTheDocument()
  })
})

describe('an expired session', () => {
  const Room = () => <p>Room at {useLocation().pathname}</p>

  const renderApp = (client: QueryClient) =>
    render(
      <Providers client={client}>
        <MemoryRouter initialEntries={['/conversations/c1']}>
          <Routes>
            <Route path='/login' element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path='/conversations/:id' element={<Room />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Providers>,
    )

  it('says so over the page, mentioning the kept draft, and signing in again returns to the same chat', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(me)
    vi.mocked(authApi.login).mockResolvedValue(me)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['conversations'], {
      data: [{ id: 'c1', type: 'group', title: 'Hi justin' } as ConversationType],
    })
    saveDraft('u1', 'c1', 'unsent words')
    renderApp(client)
    await screen.findByText('Room at /conversations/c1')

    act(() => notifySessionExpired())

    const dialog = await screen.findByRole('alertdialog', { name: 'You’ve been signed out' })
    expect(dialog).toHaveAccessibleDescription(
      'Your session expired. Sign in again to carry on — your unsent draft in “Hi justin” is kept on this device.',
    )
    // Nothing but signing in again: no close button, Escape does nothing.
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(localStorage.getItem('rtm.draft.u1.c1')).toBe('unsent words')

    await user.type(screen.getByLabelText('Email'), 'majd@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secret_123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Room at /conversations/c1')).toBeInTheDocument()
  })

  it('isn’t carried over a deliberate sign out: signing in again starts at the chat list', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.me).mockResolvedValue(me)
    vi.mocked(authApi.logout).mockResolvedValue()
    vi.mocked(authApi.login).mockResolvedValue(me)
    const SignOutHere = () => {
      const { logout } = useAuth()
      return <button onClick={() => void logout()}>Sign out</button>
    }
    render(
      <Providers>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path='/login' element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path='/profile' element={<SignOutHere />} />
              <Route path='/conversations' element={<p>Chat list</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Providers>,
    )

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    await user.type(await screen.findByLabelText('Email'), 'majd@example.com')
    await user.type(screen.getByLabelText('Password'), 'Secret_123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Chat list')).toBeInTheDocument()
  })

  it('doesn’t mention a draft when there isn’t one', async () => {
    vi.mocked(authApi.me).mockResolvedValue(me)
    renderApp(new QueryClient())
    await screen.findByText('Room at /conversations/c1')

    act(() => notifySessionExpired())

    await waitFor(() =>
      expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
        'Your session expired. Sign in again to carry on.',
      ),
    )
  })
})
