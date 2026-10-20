import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext, type AuthContextType } from '../hooks/useAuth'
import RequireAuth from '../layouts/RequireAuth'
import VerifyEmailPage from './VerifyEmailPage'
import { sendVerificationLink, verifyEmail } from '../services/api/auth'
import { rememberLinkSent } from '../utils/verificationLink'
import type { UserType } from '../utils/baseTypes'

vi.mock('../services/api/auth', () => ({
  verifyEmail: vi.fn(),
  sendVerificationLink: vi.fn(),
}))

const unconfirmed: UserType = { id: 'u1', name: 'Ada', email: 'ada@example.com', email_verified_at: null }
const confirmed: UserType = { ...unconfirmed, email_verified_at: '2026-10-20T10:00:00Z' }

const httpError = (status: number, data: object = {}) => {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', String(status), config, null, { status, statusText: '', headers: {}, config, data })
}

const auth = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: unconfirmed,
  isAuthenticated: true,
  isLoading: false,
  sessionExpired: false,
  signedOutByChoice: false,
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  register: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(undefined),
  endExpiredSession: vi.fn(),
  ...overrides,
})

const Where = () => <p>at {useLocation().pathname}</p>

// In StrictMode, as main.tsx renders the app: effects run, are torn down
// and run again on mount, which is what once left the link's page stuck on
// "Confirming your email" after the confirmation had gone through.
const renderApp = (at: string, value: AuthContextType) =>
  render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        <AuthContext.Provider value={value}>
          <MemoryRouter initialEntries={[at]}>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route path='/conversations' element={<p>the chats</p>} />
                <Route path='/verify-email' element={<VerifyEmailPage />} />
              </Route>
            </Routes>
            <Where />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    </StrictMode>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  vi.mocked(sendVerificationLink).mockResolvedValue(undefined)
  vi.mocked(verifyEmail).mockResolvedValue(undefined)
})

describe('the "Check your email" screen', () => {
  it('stands in for the app while the address is unconfirmed', async () => {
    renderApp('/conversations', auth())

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.queryByText('the chats')).not.toBeInTheDocument()
  })

  it('lets through a confirmed account, and one from an API that says nothing either way', () => {
    const { unmount } = renderApp('/conversations', auth({ user: confirmed }))
    expect(screen.getByText('the chats')).toBeInTheDocument()
    unmount()

    renderApp('/conversations', auth({ user: { id: 'u1', name: 'Ada', email: 'ada@example.com' } }))
    expect(screen.getByText('the chats')).toBeInTheDocument()
  })

  it('emails a link the first time it shows in a tab that has not sent one', async () => {
    renderApp('/conversations', auth())

    await waitFor(() => expect(sendVerificationLink).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/You can resend in/)).toBeInTheDocument()
  })

  it('does not send another right after signing up sent one, and waits out the cooldown', async () => {
    rememberLinkSent('u1')
    renderApp('/conversations', auth())

    expect(await screen.findByText(/You can resend in/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeDisabled()
    expect(sendVerificationLink).not.toHaveBeenCalled()
  })

  it('sends another on request once the cooldown is over', async () => {
    // A link this tab sent five minutes ago.
    sessionStorage.setItem('rtm.verificationLinkSentAt', `u1|${Date.now() - 5 * 60_000}`)
    renderApp('/conversations', auth())

    const resend = await screen.findByRole('button', { name: 'Resend email' })
    expect(resend).toBeEnabled()
    await userEvent.click(resend)

    await waitFor(() => expect(sendVerificationLink).toHaveBeenCalledTimes(1))
  })

  it('says so when too many links were asked for, and leaves the button usable', async () => {
    vi.mocked(sendVerificationLink).mockRejectedValue(httpError(429))
    renderApp('/conversations', auth())

    expect(await screen.findByText('Too many requests')).toBeInTheDocument()
    const resend = screen.getByRole('button', { name: 'Resend email' })
    expect(resend).toBeEnabled()
    expect(resend).not.toHaveAttribute('aria-busy')
  })

  it('shows the button busy while the first link goes out, and done once it has', async () => {
    let finish = () => {}
    vi.mocked(sendVerificationLink).mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
    renderApp('/conversations', auth())

    expect(await screen.findByRole('button', { name: 'Resend email' })).toHaveAttribute('aria-busy', 'true')
    act(() => finish())

    await waitFor(() => expect(screen.getByRole('button', { name: 'Resend email' })).not.toHaveAttribute('aria-busy'))
    expect(screen.getByText(/You can resend in/)).toBeInTheDocument()
  })

  it('blames the server, not the connection, when the email could not go out', async () => {
    vi.mocked(sendVerificationLink).mockRejectedValue(httpError(500))
    renderApp('/conversations', auth())

    expect(await screen.findByText('Couldn’t send the email')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong on our side. Try again in a few minutes.')).toBeInTheDocument()
    expect(screen.queryByText('Check your connection and try again.')).not.toBeInTheDocument()
  })

  it('asks to check the connection when the request never got an answer', async () => {
    vi.mocked(sendVerificationLink).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'))
    renderApp('/conversations', auth())

    expect(await screen.findByText('Check your connection and try again.')).toBeInTheDocument()
  })

  it('carries on by itself when another tab of this browser confirms the address', async () => {
    rememberLinkSent('u1')
    const value = auth()
    renderApp('/conversations', value)
    await screen.findByRole('heading', { name: 'Check your email' })

    const confirmationTab = new BroadcastChannel('rtm.email-confirmed')
    confirmationTab.postMessage('u1')
    confirmationTab.close()

    await waitFor(() => expect(value.refreshUser).toHaveBeenCalled())
  })

  it('pays no attention to another account being confirmed', async () => {
    rememberLinkSent('u1')
    const value = auth()
    renderApp('/conversations', value)
    await screen.findByRole('heading', { name: 'Check your email' })

    const confirmationTab = new BroadcastChannel('rtm.email-confirmed')
    confirmationTab.postMessage('someone-else')
    confirmationTab.close()

    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(value.refreshUser).not.toHaveBeenCalled()
  })

  it('checks again whenever it comes back into view, for a link opened on another device', async () => {
    const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    rememberLinkSent('u1')
    const value = auth()
    renderApp('/conversations', value)
    await screen.findByRole('heading', { name: 'Check your email' })

    fireEvent.focus(window)
    expect(value.refreshUser).toHaveBeenCalledTimes(1)

    document.dispatchEvent(new Event('visibilitychange'))
    expect(value.refreshUser).toHaveBeenCalledTimes(2)
    visible.mockRestore()
  })

  it('signs out to use another account', async () => {
    rememberLinkSent('u1')
    const value = auth()
    renderApp('/conversations', value)

    await userEvent.click(await screen.findByRole('button', { name: 'Use another account' }))

    expect(value.logout).toHaveBeenCalled()
  })
})

describe('the emailed link (/verify-email)', () => {
  const link = '/verify-email?id=u1&hash=abc&expires=123&signature=sig'

  it('confirms the address of the account signed in, then says so, with the way on into RTM', async () => {
    const otherTabsHeard: unknown[] = []
    const otherTab = new BroadcastChannel('rtm.email-confirmed')
    otherTab.onmessage = (event) => otherTabsHeard.push(event.data)
    const value = auth()
    renderApp(link, value)

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument()
    expect(verifyEmail).toHaveBeenCalledWith({ id: 'u1', hash: 'abc', expires: '123', signature: 'sig' })
    expect(verifyEmail).toHaveBeenCalledTimes(1)
    expect(value.refreshUser).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Continue to RTM' })).toHaveAttribute('href', '/conversations')
    expect(screen.getByText('at /verify-email')).toBeInTheDocument()
    await waitFor(() => expect(otherTabsHeard).toEqual(['u1']))
    otherTab.close()
  })

  it('is turned down for a link sent to another account, offering to sign out', async () => {
    vi.mocked(verifyEmail).mockRejectedValue(httpError(403, { data: { message: 'This link is for another account.' } }))
    renderApp(link, auth())

    expect(await screen.findByRole('heading', { name: 'This link is for another account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('says when the link has run out, and leads to a new one', async () => {
    vi.mocked(verifyEmail).mockRejectedValue(httpError(403, { message: 'Invalid signature.' }))
    renderApp(link, auth())

    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get a new link' })).toHaveAttribute('href', '/conversations')
  })

  it('offers to try again when confirming failed, and confirms on the second go', async () => {
    vi.mocked(verifyEmail).mockRejectedValueOnce(httpError(500))
    renderApp(link, auth())

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument()
    expect(verifyEmail).toHaveBeenCalledTimes(2)
  })

  it('calls a link missing its parts invalid, without asking the API', async () => {
    renderApp('/verify-email?id=u1', auth())

    expect(screen.getByRole('heading', { name: 'Invalid confirmation link' })).toBeInTheDocument()
    // Time enough for a request that shouldn't happen to go out.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(verifyEmail).not.toHaveBeenCalled()
  })

  it('says an address is confirmed already, without asking the API', async () => {
    renderApp(link, auth({ user: confirmed }))

    expect(screen.getByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument()
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(verifyEmail).not.toHaveBeenCalled()
  })
})
