import api from './axios'
import type { UserType } from '../../utils/baseTypes'

const getAllUsers = async (): Promise<UserType[]> => {
  const response = await api.get<{ data: UserType[] }>('/users')
  return response.data.data
}

export { getAllUsers }
