import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Spinner from '../components/ui/Spinner'
import SessionExpiredDialog from '../components/auth/SessionExpiredDialog'

const RequireAuth = () => {
  const { isAuthenticated, isLoading, signedOutByChoice } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <Spinner block />
  }

  // Signing in picks up from here again (LoginPage reads `from`) — after a
  // session expired mid-chat, or from a link opened while signed out. Not
  // after signing out on purpose: that starts afresh.
  if (!isAuthenticated) {
    return <Navigate to='/login' replace state={signedOutByChoice ? null : { from: location.pathname }} />
  }

  return (
    <>
      <Outlet />
      <SessionExpiredDialog />
    </>
  )
}

export default RequireAuth
