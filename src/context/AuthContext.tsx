import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from '../hooks/useAuth'
import * as authApi from '../services/api/auth'
import type { UserType } from '../utils/baseTypes'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const loggedInUser = await authApi.login(email, password)
    setUser(loggedInUser)
  }

  const logout = async () => {
    await authApi.logout()
    setUser(null)
  }

  const register = async (name: string, email: string, password: string, password_confirmation: string) => {
    const registeredUser = await authApi.register(name, email, password, password_confirmation)
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
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
