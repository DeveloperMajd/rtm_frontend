import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import BootScreen from '../components/ui/BootScreen'
import PasswordField from '../components/ui/PasswordField'
import AuthLayout, { AuthBanner, AuthDivider, AuthHeader, GoogleButton } from '../components/auth/AuthLayout'
import { isPasswordStrong } from '../utils/passwordRules'
import { oauthRedirectUrl } from '../services/api/auth'
import { apiMessage, fieldErrors, statusOf } from '../utils/authErrors'
import { returnPath, setReturnPathAside } from '../utils/returnPath'

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
  // Where the viewer was going when sign-in sent them here, carried over
  // from the sign-in page (see returnPath).
  const location = useLocation()

  const { mutate, isPending, error } = useMutation<void, unknown, RegisterVars>({
    mutationFn: ({ name, email, password, password_confirmation }) =>
      register(name, email, password, password_confirmation),
  })

  // Still finding out whether there's a session to skip this page for.
  if (isLoading) {
    return <BootScreen />
  }

  if (isAuthenticated) {
    return <Navigate to={returnPath(location.state)} replace />
  }

  // A rejected field is shown on that field (Auth-Register-States: "That
  // email is already registered"); anything else above the form.
  const fields = fieldErrors(error)
  const status = statusOf(error)
  const mismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation
  const canSubmit = isPasswordStrong(password) && password === passwordConfirmation

  let banner = null
  if (status === 429) {
    banner = (
      <AuthBanner tone='warn' title='Too many attempts'>
        Wait a minute before trying again.
      </AuthBanner>
    )
  } else if (error && Object.keys(fields).length === 0) {
    banner = <AuthBanner title='Couldn’t create your account'>{apiMessage(error) ?? 'Check your connection and try again.'}</AuthBanner>
  }

  return (
    <AuthLayout>
      <AuthHeader title='Create your account' subtitle='It takes a minute. You can add a photo and bio later.' />

      <form
        className='auth__form'
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          mutate({ name, email, password, password_confirmation: passwordConfirmation })
        }}
      >
        {banner}

        <fieldset className='auth__fields' disabled={isPending}>
          <legend className='sr-only'>Your details</legend>
          <Input
            id='name'
            label='Name'
            autoComplete='name'
            placeholder='Your name'
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fields.name}
          />

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

          <PasswordField id='password' label='Password' value={password} onChange={setPassword} error={fields.password} />

          <PasswordField
            id='password_confirmation'
            label='Confirm password'
            value={passwordConfirmation}
            onChange={setPasswordConfirmation}
            showRules={false}
            error={mismatch ? 'Passwords don’t match.' : undefined}
          />

          <Button type='submit' block loading={isPending} disabled={!canSubmit} className='auth__submit'>
            {isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </fieldset>
      </form>

      <AuthDivider />
      <GoogleButton href={oauthRedirectUrl('google')} onLeave={() => setReturnPathAside(returnPath(location.state))} />

      <p className='auth__alt'>
        Already have an account?{' '}
        <Link to='/login' state={location.state}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

export default RegisterPage
