import axios from 'axios'
import type { UserType } from '../../utils/baseTypes'

const baseUrl = import.meta.env.VITE_API_BASE_URL

const getAllUsers = async (): Promise<UserType[]> => {
  const response = await axios.get<{ data: UserType[] }>(`${baseUrl}/users`)
  return response.data.data
}

export { getAllUsers }
