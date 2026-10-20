import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import Button from '../components/ui/Button'
import BootScreen from '../components/ui/BootScreen'
import AuthLayout, { AuthHeader } from '../components/auth/AuthLayout'
import useAuth from '../hooks/useAuth'
import { verifyEmail } from '../services/api/auth'
import { apiMessage, statusOf } from '../utils/authErrors'
import { announceEmailConfirmed } from '../utils/emailConfirmed'

/** The API's answer to a link sent to an account other than the one signed in. */
const ANOTHER_ACCOUNT = 'This link is for another account.'

type Outcome = { state: 'confirming' } | { state: 'confirmed' } | { state: 'failed'; error: unknown }

/**
 * Where the emailed confirmation link lands: it confirms the address, says
 * so, and offers the way on into RTM. A tab still showing "Check your
 * email" carries on by itself (announceEmailConfirmed).
 *
 * It's inside RequireAuth, so someone signed out signs in first and comes
 * back here: the link only confirms the address of the account signed in,
 * which is what stops someone who signed up with another person's address
 * from having that person confirm it.
 */
const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams()
  const { user, refreshUser, logout } = useAuth()
  const userId = user?.id

  const id = searchParams.get('id') ?? ''
  const hash = searchParams.get('hash') ?? ''
  const expires = searchParams.get('expires') ?? ''
  const signature = searchParams.get('signature') ?? ''
  const complete = Boolean(id && hash && expires && signature)

  // Confirmed already when the page opened: an old link, opened again.
  const [outcome, setOutcome] = useState<Outcome>(() =>
    user?.email_verified_at ? { state: 'confirmed' } : { state: 'confirming' },
  )

  // Not a useMutation: it starts from the effect below, and a mutation's
  // observer stops hearing about its request once StrictMode has torn that
  // effect down and run it again (it isn't attached again), which left this
  // page on "Confirming your email" after the confirmation had gone through.
  const confirm = useCallback(async () => {
    try {
      await verifyEmail({ id, hash, expires, signature })
    } catch (error) {
      setOutcome({ state: 'failed', error })
      return
    }
    if (userId) announceEmailConfirmed(userId)
    await refreshUser()
    setOutcome({ state: 'confirmed' })
  }, [id, hash, expires, signature, userId, refreshUser])

  const started = useRef(false)
  useEffect(() => {
    if (started.current || outcome.state === 'confirmed' || !complete) return
    started.current = true
    void confirm()
  }, [outcome.state, complete, confirm])

  const tryAgain = () => {
    setOutcome({ state: 'confirming' })
    void confirm()
  }

  if (outcome.state === 'confirmed') {
    return (
      <AuthLayout>
        <AuthHeader
          icon='check'
          tone='success'
          title='Email confirmed'
          subtitle={
            <>
              Thanks, <strong>{user?.email}</strong> is confirmed. You’re all set to use RTM.
            </>
          }
        />
        <Link to='/conversations' className='btn primary block'>
          Continue to RTM
        </Link>
        <p className='auth__alt'>RTM open in another tab? It carries on by itself, so you can close this one.</p>
      </AuthLayout>
    )
  }

  if (!complete) {
    return (
      <AuthLayout>
        <AuthHeader
          icon='alert'
          tone='warn'
          title='Invalid confirmation link'
          subtitle='This link is missing information. Head back to RTM to get a new one.'
        />
        <Link to='/conversations' className='btn primary block'>
          Get a new link
        </Link>
      </AuthLayout>
    )
  }

  if (outcome.state === 'confirming') {
    return <BootScreen label='Confirming your email' />
  }

  const status = statusOf(outcome.error)

  if (status === 403 && apiMessage(outcome.error) === ANOTHER_ACCOUNT) {
    return (
      <AuthLayout>
        <AuthHeader
          icon='alert'
          tone='warn'
          title='This link is for another account'
          subtitle={
            <>
              You’re signed in as <strong>{user?.email}</strong>. Sign out, open the link again, and sign in with
              the account it was sent to.
            </>
          }
        />
        <div className='auth__stack'>
          <Button block onClick={() => void logout().catch(() => toast.error('Couldn’t sign out. Try again.'))}>
            Sign out
          </Button>
          <Link to='/conversations' className='btn secondary block'>
            Back to RTM
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (status === 403) {
    return (
      <AuthLayout>
        <AuthHeader
          icon='alert'
          tone='warn'
          title='This link has expired'
          subtitle='Confirmation links work for 60 minutes. Head back to RTM and we’ll email you a new one.'
        />
        <Link to='/conversations' className='btn primary block'>
          Get a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthHeader
        icon='alert'
        tone='warn'
        title={status === 429 ? 'Too many attempts' : 'Couldn’t confirm your email'}
        subtitle={status === 429 ? 'Wait a minute, then try again.' : 'Check your connection and try again.'}
      />
      <Button block onClick={tryAgain}>
        Try again
      </Button>
    </AuthLayout>
  )
}

export default VerifyEmailPage
