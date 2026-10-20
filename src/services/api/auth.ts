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

const oauthRedirectUrl = (provider: 'google'): string =>
  `${import.meta.env.VITE_API_BASE_URL}/auth/${provider}/redirect`

/** Always resolves — the backend replies the same way whether or not the
 * email is registered, so no account-enumeration signal leaks here either. */
const forgotPassword = async (email: string): Promise<void> => {
  await api.post('/auth/forgot-password', { email })
}

const resetPassword = async (payload: {
  token: string
  email: string
  password: string
  password_confirmation: string
}): Promise<void> => {
  await api.post('/auth/reset-password', payload)
}

/** The parts of an emailed confirmation link (see VerifyEmailPage). */
export type VerificationLink = { id: string; hash: string; expires: string; signature: string }

/** Posts the link back for the account signed in: it only confirms the
 * address of the account it was sent to. */
const verifyEmail = async ({ id, hash, expires, signature }: VerificationLink): Promise<void> => {
  await api.post(`/auth/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}`, null, {
    params: { expires, signature },
  })
}

/** Emails another confirmation link (nothing once the address is confirmed). */
const sendVerificationLink = async (): Promise<void> => {
  await api.post('/auth/email/verification-notification')
}

export {
  login,
  logout,
  register,
  me,
  oauthRedirectUrl,
  forgotPassword,
  resetPassword,
  verifyEmail,
  sendVerificationLink,
}
