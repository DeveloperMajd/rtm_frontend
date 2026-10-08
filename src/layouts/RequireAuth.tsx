import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import BootScreen from '../components/ui/BootScreen'
import SessionExpiredDialog from '../components/auth/SessionExpiredDialog'
import { takeReturnPath } from '../utils/returnPath'

const RequireAuth = () => {
  const { isAuthenticated, isLoading, signedOutByChoice } = useAuth()
  const location = useLocation()

  // States-Loading "App boot": the session is being checked.
  if (isLoading) {
    return <BootScreen label='Connecting' />
  }

  // Signing in picks up from here again (LoginPage reads `from`) — after a
  // session expired mid-chat, or from a link opened while signed out, with
  // its query (a `?message=` to jump to). Not after signing out on purpose:
  // that starts afresh.
  if (!isAuthenticated) {
    return (
      <Navigate
        to='/login'
        replace
        state={signedOutByChoice ? null : { from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return (
    <>
      <ReturnAfterSignIn />
      <Outlet />
      <SessionExpiredDialog />
    </>
  )
}

/**
 * Back from signing in with Google, which can't carry where the viewer was
 * going through the provider and back: LoginPage put it aside for this tab
 * (setReturnPathAside), and it's taken up once, as the signed-in app first
 * shows.
 */
const ReturnAfterSignIn = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const hasLooked = useRef(false)

  useEffect(() => {
    if (hasLooked.current) return
    hasLooked.current = true
    const path = takeReturnPath()
    if (path && path !== `${location.pathname}${location.search}`) {
      navigate(path, { replace: true })
    }
  }, [location, navigate])

  return null
}

export default RequireAuth
