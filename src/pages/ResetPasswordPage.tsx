import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import PasswordField from '../components/ui/PasswordField'
import AuthLayout, { AuthBanner, AuthHeader } from '../components/auth/AuthLayout'
import { isPasswordStrong } from '../utils/passwordRules'
import { resetPassword } from '../services/api/auth'
import { fieldErrors, statusOf } from '../utils/authErrors'

const BackToSignIn = () => (
  <p className='auth__alt'>
    <Link to='/login' className='auth__back'>
      <Icon name='arrowLeft' size={14} />
      Back to sign in
    </Link>
  </p>
)

/** Auth-Recovery-Flow 3 and 3b: choose a new password from the emailed
 * link — or, when the link is bad, say so and offer a new one. */
const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => resetPassword({ token, email, password, password_confirmation: passwordConfirmation }),
    onSuccess: () => {
      toast.success('Password reset. Sign in with your new password.')
      navigate('/login', { replace: true })
    },
  })

  const mismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation
  const canSubmit = Boolean(token && email) && isPasswordStrong(password) && password === passwordConfirmation
  const fields = fieldErrors(error)
  const status = statusOf(error)
  // A 422 that isn't about a field is the password broker turning the link
  // down — the token expired, was already used, or doesn't match the email.
  const linkRejected = status === 422 && Object.keys(fields).length === 0

  if (!token || !email) {
    return (
      <AuthLayout>
        <AuthHeader
          icon='alert'
          tone='warn'
          title='Invalid reset link'
          subtitle='This link is missing information. Request a new one from the sign-in page.'
        />
        <Link to='/forgot-password' className='btn primary block'>
          Request a new link
        </Link>
        <BackToSignIn />
      </AuthLayout>
    )
  }

  if (linkRejected) {
    return (
      <AuthLayout>
        <AuthHeader
          icon='alert'
          tone='warn'
          title='This link has expired'
          subtitle='Reset links work once and expire after 60 minutes. Request a new one and we’ll email it right away.'
        />
        <Link to='/forgot-password' state={{ email }} className='btn primary block'>
          Request a new link
        </Link>
        <BackToSignIn />
      </AuthLayout>
    )
  }

  let banner = null
  if (status === 429) {
    banner = (
      <AuthBanner tone='warn' title='Too many attempts'>
        Wait a minute before trying again.
      </AuthBanner>
    )
  } else if (error && status !== 422) {
    banner = <AuthBanner title='Couldn’t update your password'>Check your connection and try again.</AuthBanner>
  }

  return (
    <AuthLayout>
      <AuthHeader icon='key' title='Choose a new password' subtitle={`Resetting the password for ${email}`} />

      <form
        className='auth__form'
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          mutate()
        }}
      >
        {banner}
        <fieldset className='auth__fields' disabled={isPending}>
          <legend className='sr-only'>Your new password</legend>
          <PasswordField id='password' label='New password' value={password} onChange={setPassword} error={fields.password} />

          <PasswordField
            id='password_confirmation'
            label='Confirm new password'
            value={passwordConfirmation}
            onChange={setPasswordConfirmation}
            showRules={false}
            error={mismatch ? 'Passwords don’t match.' : undefined}
          />

          <Button type='submit' block loading={isPending} disabled={!canSubmit} className='auth__submit'>
            {isPending ? 'Updating…' : 'Update password'}
          </Button>
        </fieldset>
      </form>

      <BackToSignIn />
    </AuthLayout>
  )
}

export default ResetPasswordPage
