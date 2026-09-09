import api from './axios'
import type { ContactType, ConversationType } from '../../utils/baseTypes'

export const getContacts = async (): Promise<ContactType[]> => {
  const { data } = await api.get<{ data: ContactType[] }>('/contacts')
  return data.data
}

export const searchUsers = async (q: string): Promise<ContactType[]> => {
  const { data } = await api.get<{ data: ContactType[] }>('/contacts/search', {
    params: { q },
  })
  return data.data
}

type AddContactResult = { contact: ContactType; conversation: ConversationType }

export const addContact = async (userId: string): Promise<AddContactResult> => {
  const { data } = await api.post<{ data: AddContactResult }>('/contacts', {
    user_id: userId,
  })
  return data.data
}

export const removeContact = async (userId: string): Promise<void> => {
  await api.delete(`/contacts/${userId}`)
}
