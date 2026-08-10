import api from './axios'
import type { UserType } from '../../utils/baseTypes'

const login = async (email: string, password: string): Promise<UserType> => {
  const response = await api.post<{ data: UserType }>('/auth/login', {
    email,
    password,
  })
  return response.data.data
}

const logout = async (): Promise<void> => {
  await api.post('/auth/logout')
}

const register = async (
  name: string,
  email: string,
  password: string,
  password_confirmation: string,
): Promise<UserType> => {
  const response = await api.post<{ data: UserType }>('/auth/register', {
    name,
    email,
    password,
    password_confirmation,
  })
  return response.data.data
}

const me = async (): Promise<UserType> => {
  const response = await api.get<{ data: UserType }>('/auth/me')
  return response.data.data
}

const oauthRedirectUrl = (provider: 'google' | 'facebook'): string =>
  `${import.meta.env.VITE_API_BASE_URL}/auth/${provider}/redirect`

export { login, logout, register, me, oauthRedirectUrl }
