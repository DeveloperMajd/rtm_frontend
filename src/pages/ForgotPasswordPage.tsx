import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Input from '../components/ui/Input'
import AuthLayout, { AuthBanner, AuthHeader } from '../components/auth/AuthLayout'
import { forgotPassword } from '../services/api/auth'
import { fieldErrors, statusOf } from '../utils/authErrors'

// The backend's password broker won't send another link to the same address
// within 60 s (config/auth.php `throttle`) — it just quietly doesn't. So
// "Resend" waits that long too, rather than offering a send that won't come.
const RESEND_AFTER_S = 60

/** A countdown in whole seconds: `start(n)` sets it going, and it ticks
 * down from the clock (so a throttled background tab still ends on time). */
function useCountdown(): [number, (seconds: number) => void] {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (endsAt === null) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [endsAt])

  const start = (seconds: number) => {
    setEndsAt(Date.now() + seconds * 1000)
    setLeft(seconds)
  }
  return [left, start]
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** Auth-Recovery-Flow 1 and 2: ask for the email, then "Check your email",
 * with a resend that unlocks after the cooldown. */
const ForgotPasswordPage = () => {
  const location = useLocation()
  // Prefilled when arriving from an expired reset link.
  const [email, setEmail] = useState(() => {
    const from = (location.state as { email?: unknown } | null)?.email
    return typeof from === 'string' ? from : ''
  })
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [secondsLeft, startCountdown] = useCountdown()

  const { mutate, isPending, error } = useMutation({
    mutationFn: (address: string) => forgotPassword(address),
    onSuccess: (_, address) => {
      setSentTo(address)
      startCountdown(RESEND_AFTER_S)
    },
  })

  const status = statusOf(error)
  const fields = fieldErrors(error)
  let banner = null
  if (status === 429) {
    banner = (
      <AuthBanner tone='warn' title='Too many requests'>
        Wait a minute before asking for another link.
      </AuthBanner>
    )
  } else if (error && !fields.email) {
    banner = <AuthBanner title='Couldn’t send the link'>Check your connection and try again.</AuthBanner>
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <AuthHeader
          icon='mail'
          title='Check your email'
          subtitle={
            <>
              If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. It expires in 60
              minutes.
            </>
          }
        />
        {banner}
        <div className='auth__stack'>
          <Link to='/login' className='btn primary block'>
            Back to sign in
          </Link>
          <Button
            variant='secondary'
            block
            loading={isPending}
            disabled={secondsLeft > 0}
            onClick={() => mutate(sentTo)}
          >
            Resend email
          </Button>
          {secondsLeft > 0 && <p className='auth__countdown'>You can resend in {clock(secondsLeft)}</p>}
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthHeader
        icon='key'
        title='Reset your password'
        subtitle='Enter the email you signed up with and we’ll send you a link to choose a new password.'
      />

      <form
        className='auth__form'
        onSubmit={(e) => {
          e.preventDefault()
          mutate(email)
        }}
      >
        {banner}
        <fieldset className='auth__fields' disabled={isPending}>
          <legend className='sr-only'>Your email</legend>
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
          <Button type='submit' block loading={isPending} className='auth__submit'>
            {isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </fieldset>
      </form>

      <p className='auth__alt'>
        <Link to='/login' className='auth__back'>
          <Icon name='arrowLeft' size={14} />
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

export default ForgotPasswordPage
