import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'

type LoginVars = { email: string; password: string }

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isAuthenticated, isLoading } = useAuth()

  const { mutate, isPending, error } = useMutation<
    void,
    AxiosError<{ message: string }>,
    LoginVars
  >({
    mutationFn: ({ email, password }) => login(email, password),
  })
  
  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <Spinner />
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to='/conversations'
        replace
      />
    )
  }

  const apiError = error?.response?.data?.message

  return (
    <main className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='w-full max-w-sm bg-white rounded-lg shadow-md p-8 flex flex-col gap-6'>
        <h1 className='text-2xl font-semibold text-center'>Sign in to RTM</h1>

        <form
          className='flex flex-col gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            mutate({ email, password })
          }}
        >
          {apiError && (
            <p className='text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2'>
              {apiError}
            </p>
          )}

          <div className='flex flex-col gap-1'>
            <label
              htmlFor='email'
              className='text-sm font-medium text-gray-700'
            >
              Email
            </label>
            <input
              id='email'
              type='email'
              autoComplete='email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500'
            />
          </div>

          <div className='flex flex-col gap-1'>
            <label
              htmlFor='password'
              className='text-sm font-medium text-gray-700'
            >
              Password
            </label>
            <input
              id='password'
              type='password'
              autoComplete='current-password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500'
            />
          </div>

          <Button
            type='submit'
            label={isPending ? 'Signing in…' : 'Sign in'}
            disabled={isPending}
          />
        </form>

        <p className='text-sm text-center text-gray-500'>
          No account?{' '}
          <Link
            to='/register'
            className='text-blue-600 hover:underline'
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  )
}

export default LoginPage
