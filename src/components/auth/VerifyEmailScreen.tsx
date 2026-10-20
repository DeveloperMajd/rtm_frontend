import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Button from '../ui/Button'
import AuthLayout, { AuthBanner, AuthHeader } from './AuthLayout'
import useAuth from '../../hooks/useAuth'
import { clock, useCountdown } from '../../hooks/useCountdown'
import { sendVerificationLink } from '../../services/api/auth'
import { statusOf } from '../../utils/authErrors'
import { onEmailConfirmed } from '../../utils/emailConfirmed'
import { linkSentAt, rememberLinkSent } from '../../utils/verificationLink'

/** How long "Resend email" waits after a link goes out. */
export const RESEND_AFTER_S = 60

/**
 * Signed in, but the address isn't confirmed yet: nothing else until it is
 * (the API answers everything else with a 403). Signing up emails the link;
 * an account from before email verification, or one whose link couldn't go
 * out, gets one the first time this shows in a tab.
 */
const VerifyEmailScreen = () => {
  const { user, logout, refreshUser } = useAuth()
  const [secondsLeft, startCountdown] = useCountdown()
  const userId = user?.id
  // Sending from the start when this tab hasn't sent a link yet: the effect
  // below sends the first one.
  const [isSending, setIsSending] = useState(() => userId !== undefined && linkSentAt(userId) === null)
  const [error, setError] = useState<unknown>(null)

  // Not a useMutation: the first send starts from the effect below, and a
  // mutation's observer stops hearing about its request once StrictMode has
  // torn that effect down and run it again (it isn't attached again), which
  // left the button busy for good and hid any error.
  const request = useCallback(
    () =>
      sendVerificationLink().then(
        () => {
          if (userId) rememberLinkSent(userId)
          startCountdown(RESEND_AFTER_S)
          setIsSending(false)
        },
        (err: unknown) => {
          setError(err)
          setIsSending(false)
        },
      ),
    [userId, startCountdown],
  )

  const resend = () => {
    setIsSending(true)
    setError(null)
    void request()
  }

  const opened = useRef(false)
  useEffect(() => {
    if (!userId || opened.current) return
    opened.current = true
    const sentAt = linkSentAt(userId)
    if (sentAt === null) {
      void request()
      return
    }
    const waitS = RESEND_AFTER_S - Math.floor((Date.now() - sentAt) / 1000)
    if (waitS > 0) startCountdown(waitS)
  }, [userId, request, startCountdown])

  // The link opens a tab of its own. Confirmed there, in this browser, this
  // tab carries on the moment it hears so; confirmed on another device, it
  // picks that up when it's next in view.
  useEffect(() => {
    if (!userId) return
    const stopListening = onEmailConfirmed((confirmedId) => {
      if (confirmedId !== userId) return
      void refreshUser().then(() => toast.success('Email confirmed. Welcome to RTM!'))
    })
    const recheck = () => {
      if (document.visibilityState === 'visible') void refreshUser()
    }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      stopListening()
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [userId, refreshUser])

  const status = statusOf(error)
  let banner = null
  if (status === 429) {
    banner = (
      <AuthBanner tone='warn' title='Too many requests'>
        Wait a few minutes before asking for another link.
      </AuthBanner>
    )
  } else if (status !== undefined) {
    // The API answered, so the connection is fine: the email didn't go out.
    banner = (
      <AuthBanner title='Couldn’t send the email'>Something went wrong on our side. Try again in a few minutes.</AuthBanner>
    )
  } else if (error) {
    banner = <AuthBanner title='Couldn’t send the link'>Check your connection and try again.</AuthBanner>
  }

  const signOut = () => {
    logout().catch(() => toast.error('Couldn’t sign out. Check your connection and try again.'))
  }

  return (
    <AuthLayout>
      <AuthHeader
        icon='mail'
        title='Check your email'
        subtitle={
          <>
            To start using RTM, open the link we sent to <strong>{user?.email}</strong>. It expires in 60 minutes.
          </>
        }
      />
      {banner}
      <div className='auth__stack'>
        <Button variant='secondary' block loading={isSending} disabled={secondsLeft > 0} onClick={resend}>
          Resend email
        </Button>
        {secondsLeft > 0 && <p className='auth__countdown'>You can resend in {clock(secondsLeft)}</p>}
        <Button variant='ghost' block onClick={signOut}>
          Use another account
        </Button>
      </div>
      <p className='auth__alt'>Opening it on another device? You’ll sign in there first.</p>
    </AuthLayout>
  )
}

export default VerifyEmailScreen
