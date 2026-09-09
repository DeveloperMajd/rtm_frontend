import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import BrandMark from '../components/ui/BrandMark'
import { oauthRedirectUrl } from '../services/api/auth'

type LoginVars = { email: string; password: string }

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isAuthenticated, isLoading } = useAuth()
  const [searchParams] = useSearchParams()

  const { mutate, isPending, error } = useMutation<
    void,
    AxiosError<{ message: string }>,
    LoginVars
  >({
    mutationFn: ({ email, password }) => login(email, password),
  })

  if (isLoading) {
    return <Spinner block />
  }

  if (isAuthenticated) {
    return <Navigate to='/conversations' replace />
  }

  const apiError = error?.response?.data?.message
  const oauthError =
    searchParams.get('error') === 'oauth_failed'
      ? 'Sign-in with that provider failed. Please try again.'
      : null
  const displayedError = apiError ?? oauthError

  return (
    <main className='auth'>
      <div className='auth__card'>
        <BrandMark />
        <h1 className='auth__title'>Welcome back</h1>
        <p className='auth__subtitle'>Sign in to continue to RTM</p>

        <form
          className='auth__form'
          onSubmit={(e) => {
            e.preventDefault()
            mutate({ email, password })
          }}
        >
          {displayedError && (
            <p className='auth__error' role='alert'>
              {displayedError}
            </p>
          )}

          <div className='field'>
            <label className='field__label' htmlFor='email'>
              Email
            </label>
            <input
              id='email'
              className='input'
              type='email'
              autoComplete='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className='field'>
            <label className='field__label' htmlFor='password'>
              Password
            </label>
            <input
              id='password'
              className='input'
              type='password'
              autoComplete='current-password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type='submit' block loading={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className='auth__divider'>or</div>

        <div className='auth__oauth'>
          <a href={oauthRedirectUrl('google')} className='btn secondary block'>
            Continue with Google
          </a>
          <a href={oauthRedirectUrl('facebook')} className='btn secondary block'>
            Continue with Facebook
          </a>
        </div>

        <p className='auth__alt'>
          No account? <Link to='/register'>Create one</Link>
        </p>
      </div>
    </main>
  )
}

export default LoginPage
