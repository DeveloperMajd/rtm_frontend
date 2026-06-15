import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Spinner from '../components/ui/Spinner'

const RequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <Spinner />
      </div>
    )
  }

  return isAuthenticated ? <Outlet /> : <Navigate to='/login' replace />
}

export default RequireAuth
