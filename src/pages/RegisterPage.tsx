import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import BrandMark from '../components/ui/BrandMark'
import { oauthRedirectUrl } from '../services/api/auth'

type RegisterVars = {
  name: string
  email: string
  password: string
  password_confirmation: string
}

const RegisterPage = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const { register, isAuthenticated, isLoading } = useAuth()

  const { mutate, isPending, error } = useMutation<
    void,
    AxiosError<{ message: string }>,
    RegisterVars
  >({
    mutationFn: ({ name, email, password, password_confirmation }) =>
      register(name, email, password, password_confirmation),
  })

  if (isLoading) {
    return <Spinner block />
  }

  if (isAuthenticated) {
    return <Navigate to='/conversations' replace />
  }

  const apiError = error?.response?.data?.message
  const mismatch =
    passwordConfirmation.length > 0 && password !== passwordConfirmation

  return (
    <main className='auth'>
      <div className='auth__card'>
        <BrandMark />
        <h1 className='auth__title'>Create your account</h1>
        <p className='auth__subtitle'>Start chatting on RTM in seconds</p>

        <form
          className='auth__form'
          onSubmit={(e) => {
            e.preventDefault()
            if (mismatch) return
            mutate({ name, email, password, password_confirmation: passwordConfirmation })
          }}
        >
          {apiError && (
            <p className='auth__error' role='alert'>
              {apiError}
            </p>
          )}

          <div className='field'>
            <label className='field__label' htmlFor='name'>
              Name
            </label>
            <input
              id='name'
              className='input'
              type='text'
              autoComplete='name'
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
              autoComplete='new-password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className='field'>
            <label className='field__label' htmlFor='password_confirmation'>
              Confirm password
            </label>
            <input
              id='password_confirmation'
              className='input'
              type='password'
              autoComplete='new-password'
              required
              aria-invalid={mismatch || undefined}
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
            />
            {mismatch && <span className='field__error'>Passwords don&rsquo;t match.</span>}
          </div>

          <Button type='submit' block loading={isPending} disabled={mismatch}>
            {isPending ? 'Creating account…' : 'Create account'}
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
          Already have an account? <Link to='/login'>Sign in</Link>
        </p>
      </div>
    </main>
  )
}

export default RegisterPage
