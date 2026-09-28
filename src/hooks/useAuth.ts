import { useContext, createContext } from 'react'
import type { UserType } from '../utils/baseTypes'

export type AuthContextType = {
  user: UserType | null
  isAuthenticated: boolean
  isLoading: boolean
  /** The server rejected a request as signed out while the app still
   * thought it was signed in — the session expired or was ended elsewhere. */
  sessionExpired: boolean
  /** Signed out deliberately (not expired), until the next sign in — the
   * next sign in then starts from the chat list, not the page left. */
  signedOutByChoice: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (name: string, email: string, password: string, password_confirmation: string) => Promise<void>
  /** Re-fetch the current user (e.g. after a profile update). */
  refreshUser: () => Promise<void>
  /** Leave an expired session behind and head to sign in. */
  endExpiredSession: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default useAuth
