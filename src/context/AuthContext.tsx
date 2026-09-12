import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext } from '../hooks/useAuth'
import * as authApi from '../services/api/auth'
import * as presenceApi from '../services/api/presence'
import { primeCsrf } from '../services/api/csrf'
import type { UserType } from '../utils/baseTypes'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Prime the CSRF cookie once so the first mutating request has a token,
    // then resolve the current session.
    primeCsrf()
      .catch(() => {
        /* non-fatal: same-site dev works without it */
      })
      .then(() => authApi.me())
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      setUser(await authApi.me())
    } catch {
      setUser(null)
    }
  }, [])

  const login = async (email: string, password: string) => {
    await primeCsrf()
    const loggedInUser = await authApi.login(email, password)
    // Query keys here (['conversations'], ['messages', id], ['contacts'], …)
    // aren't scoped by user id, so anything cached under them belongs to
    // whoever was signed in before — never this new session.
    queryClient.clear()
    setUser(loggedInUser)
  }

  const logout = async () => {
    // Must run before authApi.logout() invalidates the session — once the
    // session is gone, this request can't authenticate as this user anymore
    // and presence would only clear later via the Redis TTL expiring.
    try {
      await presenceApi.leave()
    } catch {
      // best-effort; the Redis TTL will still expire the key on its own
    }

    await authApi.logout()
    queryClient.clear()
    setUser(null)
  }

  const register = async (name: string, email: string, password: string, password_confirmation: string) => {
    await primeCsrf()
    const registeredUser = await authApi.register(name, email, password, password_confirmation)
    queryClient.clear()
    setUser(registeredUser)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        logout,
        register,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
