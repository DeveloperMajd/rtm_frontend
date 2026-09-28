import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { AuthContext } from '../hooks/useAuth'
import * as authApi from '../services/api/auth'
import * as presenceApi from '../services/api/presence'
import { primeCsrf } from '../services/api/csrf'
import { onSessionExpired } from '../services/api/sessionEvents'
import { clearDrafts } from '../utils/drafts'
import type { UserType } from '../utils/baseTypes'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Set by any 401 (see below); it only counts while someone is signed in.
  const [rejected, setRejected] = useState(false)
  const [signedOutByChoice, setSignedOutByChoice] = useState(false)
  const queryClient = useQueryClient()
  const signingOutRef = useRef(false)

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

  // A 401 while signed in: the server has dropped this session (it expired,
  // or was ended elsewhere). Everything on screen stays put under a dialog
  // until the viewer chooses to sign in again — see SessionExpiredDialog.
  // Ignored during a deliberate sign out, whose own requests can 401 on the
  // way, and meaningless while signed out (`sessionExpired` below).
  useEffect(
    () =>
      onSessionExpired(() => {
        if (!signingOutRef.current) setRejected(true)
      }),
    [],
  )
  const sessionExpired = rejected && user !== null

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
    setRejected(false)
    setSignedOutByChoice(false)
    setUser(loggedInUser)
  }

  const logout = async () => {
    signingOutRef.current = true
    try {
      // Must run before authApi.logout() invalidates the session — once the
      // session is gone, this request can't authenticate as this user anymore
      // and presence would only clear later via the Redis TTL expiring.
      try {
        await presenceApi.leave()
      } catch {
        // best-effort; the Redis TTL will still expire the key on its own
      }

      try {
        await authApi.logout()
      } catch (err) {
        // A 401 means the session had already ended — signed out either way.
        // Anything else (offline, a 5xx) leaves the session alive, so say so
        // rather than pretend.
        if (!isAxiosError(err) || err.response?.status !== 401) throw err
      }

      if (user) clearDrafts(user.id)
      queryClient.clear()
      setRejected(false)
      setSignedOutByChoice(true)
      setUser(null)
    } finally {
      signingOutRef.current = false
    }
  }

  const register = async (name: string, email: string, password: string, password_confirmation: string) => {
    await primeCsrf()
    const registeredUser = await authApi.register(name, email, password, password_confirmation)
    queryClient.clear()
    setRejected(false)
    setSignedOutByChoice(false)
    setUser(registeredUser)
  }

  /** "Sign in again" from the session-expired dialog: drop the dead session
   * locally so the router sends the viewer to sign in — and, once they have,
   * back to where they were. Drafts are left alone for them to pick up. */
  const endExpiredSession = () => {
    setRejected(false)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        sessionExpired,
        signedOutByChoice,
        login,
        logout,
        register,
        refreshUser,
        endExpiredSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
