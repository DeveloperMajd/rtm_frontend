import type { AxiosProgressEvent } from 'axios'
import api from './axios'
import type { UserType } from '../../utils/baseTypes'

type ProfilePayload = { name?: string; bio?: string | null }

export const getProfile = async (): Promise<UserType> => {
  const { data } = await api.get<{ data: UserType }>('/profile')
  return data.data
}

export const updateProfile = async (payload: ProfilePayload): Promise<UserType> => {
  const { data } = await api.patch<{ data: UserType }>('/profile', payload)
  return data.data
}

export const uploadAvatar = async (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UserType> => {
  const form = new FormData()
  form.append('avatar', file)
  const { data } = await api.post<{ data: UserType }>('/profile/avatar', form, {
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data.data
}

export const deleteAvatar = async (): Promise<UserType> => {
  const { data } = await api.delete<{ data: UserType }>('/profile/avatar')
  return data.data
}

export const changePassword = async (payload: {
  current_password: string
  password: string
  password_confirmation: string
}): Promise<void> => {
  await api.patch('/profile/password', payload)
}
