import api from './axios'
import type {
  AttachmentType,
  MessageSearchResultType,
  MessageType,
} from '../../utils/baseTypes'

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
  replyToMessageId?: string,
  attachmentIds?: string[],
): Promise<void> => {
  await api.post('/messages', {
    conversation_id: conversationId,
    body: body.trim() || undefined,
    reply_to_message_id: replyToMessageId,
    attachment_ids: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined,
  })
}

const uploadAttachment = async (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<AttachmentType> => {
  const form = new FormData()
  form.append('file', file)

  const response = await api.post<{ data: AttachmentType }>('/attachments', form, {
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    },
  })

  return response.data.data
}

const updateMessage = async (messageId: string, body: string): Promise<void> => {
  await api.patch(`/messages/${messageId}`, { body })
}

const deleteMessage = async (messageId: string): Promise<void> => {
  await api.delete(`/messages/${messageId}`)
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

const addReaction = async (messageId: string, reaction: string): Promise<void> => {
  await api.post(`/messages/${messageId}/reactions`, { reaction })
}

const removeReaction = async (messageId: string, reaction: string): Promise<void> => {
  await api.delete(`/messages/${messageId}/reactions/${encodeURIComponent(reaction)}`)
}

export {
  getMessagesByConversationId,
  sendMessage,
  uploadAttachment,
  updateMessage,
  deleteMessage,
  searchMessages,
  addReaction,
  removeReaction,
}
