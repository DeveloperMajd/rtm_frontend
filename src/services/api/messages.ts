import api from './axios'
import type { MessageSearchResultType, MessageType } from '../../utils/baseTypes'

type MessagesResponse = {
  data: MessageType[]
  meta: { last_page: number; current_page: number }
}

const getMessagesByConversationId = async (
  conversationId: string,
  page = 1,
): Promise<MessagesResponse> => {
  const response = await api.get<MessagesResponse>(
    `/conversations/${conversationId}/messages`,
    { params: { page } },
  )
  return response.data
}

const sendMessage = async (
  conversationId: string,
  body: string,
): Promise<void> => {
  await api.post('/messages', { conversation_id: conversationId, body })
}

const searchMessages = async (
  query: string,
): Promise<MessageSearchResultType[]> => {
  const response = await api.get<{ data: MessageSearchResultType[] }>(
    '/messages/search',
    { params: { q: query } },
  )
  return response.data.data
}

export { getMessagesByConversationId, sendMessage, searchMessages }
