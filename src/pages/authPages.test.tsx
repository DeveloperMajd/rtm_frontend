import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextType } from '../hooks/useAuth'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import ResetPasswordPage from './ResetPasswordPage'
import { forgotPassword, resetPassword } from '../services/api/auth'

vi.mock('../services/api/auth', () => ({
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  oauthRedirectUrl: () => '/api/auth/google/redirect',
}))

const httpError = (status: number, data: object = {}) => {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', String(status), config, null, { status, statusText: '', headers: {}, config, data })
}

const auth = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  sessionExpired: false,
  signedOutByChoice: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
  endExpiredSession: vi.fn(),
  ...overrides,
})

const Providers = ({ children, value, at }: { children: ReactNode; value: AuthContextType; at: string }) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route path='*' element={children} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
}

const renderAt = (at: string, page: ReactNode, value = auth()) =>
  render(
    <Providers value={value} at={at}>
      {page}
    </Providers>,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  const signIn = async () => {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'majd@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
  }

  it('says the email or password is wrong, without guessing which', async () => {
    renderAt('/login', <LoginPage />, auth({ login: vi.fn().mockRejectedValue(httpError(401)) }))

    await signIn()

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Email or password is incorrect')
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid')
  })

  it('asks for a pause after too many attempts', async () => {
    renderAt('/login', <LoginPage />, auth({ login: vi.fn().mockRejectedValue(httpError(429)) }))

    await signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts')
  })

  it('locks the form while signing in', async () => {
    renderAt('/login', <LoginPage />, auth({ login: vi.fn().mockReturnValue(new Promise(() => {})) }))

    await signIn()

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled()
    expect(screen.getByLabelText('Email')).toBeDisabled()
  })

  it('reports a failed Google sign-in', () => {
    renderAt('/login?error=oauth_failed', <LoginPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in with that provider failed')
  })
})

describe('RegisterPage', () => {
  it('shows what the server rejected on the field it’s about', async () => {
    const user = userEvent.setup()
    const register = vi
      .fn()
      .mockRejectedValue(httpError(422, { message: 'x', errors: { email: ['The email has already been taken.'] } }))
    renderAt('/register', <RegisterPage />, auth({ register }))

    await user.type(screen.getByLabelText('Name'), 'Majd')
    await user.type(screen.getByLabelText('Email'), 'taken@example.com')
    await user.type(screen.getByLabelText('Password'), 'Str0ng_pass')
    await user.type(screen.getByLabelText('Confirm password'), 'Str0ng_pass')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription('The email has already been taken.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('can’t be sent until the password meets every rule and matches', async () => {
    const user = userEvent.setup()
    renderAt('/register', <RegisterPage />)
    const create = screen.getByRole('button', { name: 'Create account' })

    await user.type(screen.getByLabelText('Password'), 'Str0ng_pass')
    await user.type(screen.getByLabelText('Confirm password'), 'Str0ng_pas')
    expect(create).toBeDisabled()
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords don’t match.')

    await user.type(screen.getByLabelText('Confirm password'), 's')
    expect(create).toBeEnabled()
  })
})

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('says to check the email, and lets it be resent once the cooldown is over', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.mocked(forgotPassword).mockResolvedValue()
    renderAt('/forgot-password', <ForgotPasswordPage />)

    await user.type(screen.getByLabelText('Email'), 'majd@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText('majd@example.com')).toBeInTheDocument()
    const resend = screen.getByRole('button', { name: 'Resend email' })
    expect(resend).toBeDisabled()
    expect(screen.getByText('You can resend in 1:00')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(61_000))
    await waitFor(() => expect(resend).toBeEnabled())

    await user.click(resend)
    expect(forgotPassword).toHaveBeenCalledTimes(2)
    expect(vi.mocked(forgotPassword).mock.calls[1][0]).toBe('majd@example.com')
  })

  it('asks for a pause after too many requests', async () => {
    const user = userEvent.setup()
    vi.mocked(forgotPassword).mockRejectedValue(httpError(429))
    renderAt('/forgot-password', <ForgotPasswordPage />)

    await user.type(screen.getByLabelText('Email'), 'majd@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests')
  })
})

describe('ResetPasswordPage', () => {
  const link = '/reset-password?token=t0k&email=majd%40example.com'

  const choose = async () => {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('New password'), 'Str0ng_pass')
    await user.type(screen.getByLabelText('Confirm new password'), 'Str0ng_pass')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
  }

  it('explains a link the server turned down, and offers a new one', async () => {
    vi.mocked(resetPassword).mockRejectedValue(httpError(422, { data: { message: 'This password reset token is invalid.' } }))
    renderAt(link, <ResetPasswordPage />)

    await choose()

    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('shows a rejected password on the field', async () => {
    vi.mocked(resetPassword).mockRejectedValue(
      httpError(422, { errors: { password: ['The password has appeared in a data leak.'] } }),
    )
    renderAt(link, <ResetPasswordPage />)

    await choose()

    await waitFor(() =>
      expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
        expect.stringContaining('The password has appeared in a data leak.'),
      ),
    )
  })

  it('says a link missing its token is invalid', () => {
    renderAt('/reset-password', <ResetPasswordPage />)

    expect(screen.getByRole('heading', { name: 'Invalid reset link' })).toBeInTheDocument()
  })
})
