import { useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import PasswordField from '../components/ui/PasswordField'
import BootScreen from '../components/ui/BootScreen'
import AuthLayout, { AuthBanner, AuthDivider, AuthHeader, GoogleButton } from '../components/auth/AuthLayout'
import { oauthRedirectUrl } from '../services/api/auth'
import { fieldErrors, statusOf } from '../utils/authErrors'

type LoginVars = { email: string; password: string }

/** Where to go once signed in: back to the page that sent the viewer here
 * (RequireAuth passes it along), or the chat list. Only ever an in-app
 * path. */
function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from
  return '/conversations'
}

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isAuthenticated, isLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const { mutate, isPending, error, isIdle } = useMutation<void, unknown, LoginVars>({
    mutationFn: ({ email, password }) => login(email, password),
  })

  // Still finding out whether there's a session to skip this page for.
  if (isLoading) {
    return <BootScreen />
  }

  if (isAuthenticated) {
    return <Navigate to={returnPath(location.state)} replace />
  }

  const status = statusOf(error)
  const fields = fieldErrors(error)
  const oauthFailed = isIdle && searchParams.get('error') === 'oauth_failed'

  let banner = null
  if (status === 401) {
    banner = <AuthBanner title='Email or password is incorrect'>Check them and try again.</AuthBanner>
  } else if (status === 429) {
    banner = (
      <AuthBanner tone='warn' title='Too many attempts'>
        Wait a minute before trying again.
      </AuthBanner>
    )
  } else if (error && status !== 422) {
    banner = <AuthBanner title='Couldn’t sign you in'>Check your connection and try again.</AuthBanner>
  } else if (oauthFailed) {
    banner = <AuthBanner title='Sign-in with that provider failed'>Please try again.</AuthBanner>
  }

  return (
    <AuthLayout>
      <AuthHeader title='Welcome back' subtitle='Sign in to pick up your conversations.' />

      <form
        className='auth__form'
        onSubmit={(e) => {
          e.preventDefault()
          mutate({ email, password })
        }}
      >
        {banner}

        <fieldset className='auth__fields' disabled={isPending}>
          <legend className='sr-only'>Your email and password</legend>
          <Input
            id='email'
            label='Email'
            type='email'
            autoComplete='email'
            placeholder='you@example.com'
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fields.email}
          />

          <PasswordField
            id='password'
            label='Password'
            value={password}
            onChange={setPassword}
            autoComplete='current-password'
            showRules={false}
            error={fields.password}
            labelAside={
              <Link to='/forgot-password' className='auth__link-small'>
                Forgot password?
              </Link>
            }
          />

          <Button type='submit' block loading={isPending} className='auth__submit'>
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </fieldset>
      </form>

      <AuthDivider />
      <GoogleButton href={oauthRedirectUrl('google')} />

      <p className='auth__alt'>
        New to RTM? <Link to='/register'>Create an account</Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
