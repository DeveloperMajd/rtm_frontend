import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Spinner from '../components/ui/Spinner'

const RequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <Spinner block />
  }

  return isAuthenticated ? <Outlet /> : <Navigate to='/login' replace />
}

export default RequireAuth
