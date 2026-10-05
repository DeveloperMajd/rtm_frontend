import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import BootScreen from '../components/ui/BootScreen'
import SessionExpiredDialog from '../components/auth/SessionExpiredDialog'

const RequireAuth = () => {
  const { isAuthenticated, isLoading, signedOutByChoice } = useAuth()
  const location = useLocation()

  // States-Loading "App boot": the session is being checked.
  if (isLoading) {
    return <BootScreen label='Connecting' />
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
