import api from './axios'
import type {
  AttachmentType,
  MessageSearchResultType,
  MessageType,
} from '../../utils/baseTypes'
import type { MessagesPage } from '../../utils/messagePages'

/**
 * Which page of a conversation's history to read. History is paged by
 * cursor — a message id to read from — rather than by page number, because
 * page numbers are offsets from an end of the list that keeps moving as
 * messages arrive (see the API's own note on MessageController::index).
 */
export type MessagesPageParam =
  /** The newest messages. */
  | { kind: 'latest' }
  /** Older than a message: scrolling back through history. */
  | { kind: 'older'; before: string }
  /** Newer than a message: catching back up from a jump. */
  | { kind: 'newer'; after: string }
  /** A window around one message, opened by a jump to it. */
  | { kind: 'around'; id: string }

type HistoryResponse = {
  data: MessageType[]
  meta: { has_more: boolean; next_before_id?: string | null; next_after_id?: string | null }
}

type ContextResponse = {
  data: MessageType[]
  meta: {
    target_id: string
    has_more_before: boolean
    has_more_after: boolean
    next_before_id: string | null
    next_after_id: string | null
  }
}

/**
 * Fetches one page of history, oldest message first, as the one page shape
 * every window is cached in (see MessagesPage) — whichever way it was read.
 */
const getMessagesPage = async (
  conversationId: string,
  param: MessagesPageParam,
): Promise<MessagesPage> => {
  if (param.kind === 'around') {
    const { data } = await api.get<ContextResponse>(
      `/conversations/${conversationId}/messages/${param.id}/context`,
    )
    return {
      data: data.data,
      meta: {
        has_more: data.meta.has_more_before,
        next_before_id: data.meta.next_before_id,
        next_after_id: data.meta.next_after_id,
      },
    }
  }

  if (param.kind === 'newer') {
    const { data } = await api.get<HistoryResponse>(`/conversations/${conversationId}/messages`, {
      params: { after_id: param.after },
    })
    return {
      data: data.data,
      meta: {
        // Read forwards, `has_more` is about newer messages. The page still
        // needs an older cursor of its own: refetching a window rebuilds it
        // from its first page down, each page's cursor leading to the next,
        // and this page is first once it's in front. There is always older
        // history below it — at the very least the message it was read after.
        has_more: data.data.length > 0,
        next_before_id: data.data[0]?.id ?? null,
        next_after_id: data.meta.has_more ? (data.meta.next_after_id ?? null) : null,
      },
    }
  }

  const { data } = await api.get<HistoryResponse>(`/conversations/${conversationId}/messages`, {
    params: param.kind === 'older' ? { before_id: param.before } : undefined,
  })
  return {
    data: data.data,
    meta: { has_more: data.meta.has_more, next_before_id: data.meta.next_before_id ?? null },
  }
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

/** The ⌘K palette's search: the best 20 matches everywhere, or in one
 * conversation (its "This conversation" scope). */
const searchMessages = async (
  query: string,
  conversationId?: string,
): Promise<MessageSearchResultType[]> => {
  const response = await api.get<{ data: MessageSearchResultType[] }>(
    '/messages/search',
    { params: conversationId ? { q: query, conversation_id: conversationId } : { q: query } },
  )
  return response.data.data
}

/** The most matches the API returns for one conversation. */
export const CONVERSATION_SEARCH_LIMIT = 50

/** The in-chat search bar's search: the newest 50 matches in one
 * conversation, newest first, and how many there are in all. */
const searchConversation = async (
  conversationId: string,
  query: string,
): Promise<{ results: MessageSearchResultType[]; total: number }> => {
  const response = await api.get<{ data: MessageSearchResultType[]; meta: { total: number } }>(
    '/messages/search',
    { params: { q: query, conversation_id: conversationId, sort: 'recent', limit: CONVERSATION_SEARCH_LIMIT } },
  )
  return { results: response.data.data, total: response.data.meta.total }
}

const addReaction = async (messageId: string, reaction: string): Promise<void> => {
  await api.post(`/messages/${messageId}/reactions`, { reaction })
}

const removeReaction = async (messageId: string, reaction: string): Promise<void> => {
  await api.delete(`/messages/${messageId}/reactions/${encodeURIComponent(reaction)}`)
}

export {
  getMessagesPage,
  sendMessage,
  uploadAttachment,
  updateMessage,
  deleteMessage,
  searchMessages,
  searchConversation,
  addReaction,
  removeReaction,
}
