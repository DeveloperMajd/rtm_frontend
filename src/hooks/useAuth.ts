import { useContext, createContext } from 'react'
import type { UserType } from '../utils/baseTypes'

export type AuthContextType = {
  user: UserType | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (name: string, email: string, password: string, password_confirmation: string) => Promise<void>
  /** Re-fetch the current user (e.g. after a profile update). */
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default useAuth
