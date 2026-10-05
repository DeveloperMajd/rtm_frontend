import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import NotFoundPage from '../../pages/NotFoundPage'
import ServerErrorPage from './ServerErrorPage'

/**
 * The router's own error screen. React Router catches a route that throws
 * before any outer boundary can, and would otherwise show its default
 * developer page — this puts the app's 404 or 500 there instead.
 */
const RouteError = () => {
  const error = useRouteError()

  useEffect(() => {
    console.error('Unhandled route error:', error)
  }, [error])

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  return <ServerErrorPage />
}

export default RouteError
