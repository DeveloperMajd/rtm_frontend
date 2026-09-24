import api from './axios'
import type {
  AttachmentType,
  MessageSearchResultType,
  MessageType,
} from '../../utils/baseTypes'

type MessagesResponse = {
  data: MessageType[]
  meta: { has_more: boolean; next_before_id: string | null }
}

/**
 * Fetches a page of history, newest first. `beforeId` is a cursor — the id to
 * read backwards from — rather than a page number, because page numbers are
 * offsets from an end of the list that keeps moving as messages arrive (see
 * the API's own note on MessageController::index).
 */
const getMessagesByConversationId = async (
  conversationId: string,
  beforeId?: string | null,
): Promise<MessagesResponse> => {
  const response = await api.get<MessagesResponse>(
    `/conversations/${conversationId}/messages`,
    { params: beforeId ? { before_id: beforeId } : undefined },
  )
  return response.data
}

/** Resolves with the created message: the server already returns it, and
 * using it lets the composer put the message on screen straight away
 * instead of refetching the conversation to find out what it just sent. */
const sendMessage = async (
  conversationId: string,
  body: string,
  replyToMessageId?: string,
  attachmentIds?: string[],
): Promise<MessageType> => {
  const response = await api.post<{ data: MessageType }>('/messages', {
    conversation_id: conversationId,
    body: body.trim() || undefined,
    reply_to_message_id: replyToMessageId,
    attachment_ids: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined,
  })
  return response.data.data
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

/** Resolves with the edited message, for the same reason as sendMessage:
 * the edit can show the moment the server accepts it. */
const updateMessage = async (messageId: string, body: string): Promise<MessageType> => {
  const response = await api.patch<{ data: MessageType }>(`/messages/${messageId}`, { body })
  return response.data.data
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
