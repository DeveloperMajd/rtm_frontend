import api from './axios'
import type { ConversationType } from '../../utils/baseTypes'

type ConversationsResponse = { data: ConversationType[] }
type ConversationResponse = { data: ConversationType }

const getAllConversations = async (): Promise<ConversationsResponse> => {
  const response = await api.get<ConversationsResponse>('/conversations')
  return response.data
}

const getConversationById = async (
  conversationId: string,
): Promise<ConversationResponse> => {
  const response = await api.get<ConversationResponse>(
    `/conversations/${conversationId}`,
  )
  return response.data
}

const createConversation = async (conversationData: {
  type: 'group' | 'direct'
  title?: string
  participant_ids: string[]
}): Promise<ConversationResponse> => {
  const response = await api.post<ConversationResponse>(
    '/conversations',
    conversationData,
  )
  return response.data
}

const postTyping = async (conversationId: string): Promise<void> => {
  await api.post(`/conversations/${conversationId}/typing`)
}

export { getAllConversations, getConversationById, createConversation, postTyping }
