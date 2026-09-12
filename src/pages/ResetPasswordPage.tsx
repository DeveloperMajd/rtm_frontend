import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { AxiosError } from 'axios'
import BrandMark from '../components/ui/BrandMark'
import Button from '../components/ui/Button'
import PasswordField from '../components/ui/PasswordField'
import { isPasswordStrong } from '../utils/passwordRules'
import { resetPassword } from '../services/api/auth'

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')

  const { mutate, isPending, error } = useMutation<
    void,
    AxiosError<{ data?: { message?: string } }>,
    void
  >({
    mutationFn: () => resetPassword({ token, email, password, password_confirmation: passwordConfirmation }),
    onSuccess: () => {
      toast.success('Password reset. Sign in with your new password.')
      navigate('/login', { replace: true })
    },
  })

  const mismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation
  const canSubmit = Boolean(token && email) && isPasswordStrong(password) && password === passwordConfirmation
  const apiError = error?.response?.data?.data?.message

  if (!token || !email) {
    return (
      <main className='auth'>
        <div className='auth__card'>
          <BrandMark />
          <h1 className='auth__title'>Invalid reset link</h1>
          <p className='auth__subtitle'>
            This link is missing information. Request a new one from the sign-in page.
          </p>
          <p className='auth__alt'>
            <Link to='/forgot-password'>Request a new link</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className='auth'>
      <div className='auth__card'>
        <BrandMark />
        <h1 className='auth__title'>Choose a new password</h1>
        <p className='auth__subtitle'>Resetting the password for {email}</p>

        <form
          className='auth__form'
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSubmit) return
            mutate()
          }}
        >
          {apiError && (
            <p className='auth__error' role='alert'>
              {apiError}
            </p>
          )}

          <PasswordField id='password' label='New password' value={password} onChange={setPassword} />

          <div className='field'>
            <label className='field__label' htmlFor='password_confirmation'>
              Confirm new password
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

          <Button type='submit' block loading={isPending} disabled={!canSubmit}>
            Reset password
          </Button>
        </form>

        <p className='auth__alt'>
          <Link to='/login'>&larr; Back to sign in</Link>
        </p>
      </div>
    </main>
  )
}

export default ResetPasswordPage
