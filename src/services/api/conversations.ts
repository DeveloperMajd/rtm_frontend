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

const renameConversation = async (
  conversationId: string,
  title: string,
): Promise<ConversationResponse> => {
  const response = await api.patch<ConversationResponse>(
    `/conversations/${conversationId}`,
    { title },
  )
  return response.data
}

const postTyping = async (conversationId: string): Promise<void> => {
  await api.post(`/conversations/${conversationId}/typing`)
}

/** Moves the viewer's read pointer up to `messageId` — or to the newest
 * message, without one. The server never moves it backwards. */
const markConversationAsRead = async (conversationId: string, messageId?: string): Promise<void> => {
  await api.post(`/conversations/${conversationId}/read`, messageId ? { message_id: messageId } : undefined)
}

/** How far someone still in the conversation has read. */
export type ReadPointer = {
  user_id: string
  last_read_message_id: string | null
  last_read_at: string | null
}

const getReadPointers = async (conversationId: string): Promise<ReadPointer[]> => {
  const response = await api.get<{ data: ReadPointer[] }>(`/conversations/${conversationId}/reads`)
  return response.data.data
}

const addParticipant = async (conversationId: string, userId: string): Promise<void> => {
  await api.post(`/conversations/${conversationId}/participants`, { user_id: userId })
}

const kickParticipant = async (conversationId: string, userId: string): Promise<void> => {
  await api.delete(`/conversations/${conversationId}/participants/${userId}/kick`)
}

/** Leave a group on your own. Throws (422) if you're the sole admin and
 * other active members remain — promote someone first. */
const leaveConversation = async (conversationId: string, userId: string): Promise<void> => {
  await api.delete(`/conversations/${conversationId}/participants/${userId}`)
}

const updateParticipantRole = async (
  conversationId: string,
  userId: string,
  role: 'admin' | 'participant',
): Promise<void> => {
  await api.patch(`/conversations/${conversationId}/participants/${userId}`, { role })
}

/** Admin-only: deletes a group for every member. Not supported for direct
 * conversations. */
const deleteConversation = async (conversationId: string): Promise<void> => {
  await api.delete(`/conversations/${conversationId}`)
}

export {
  getAllConversations,
  getConversationById,
  createConversation,
  renameConversation,
  postTyping,
  markConversationAsRead,
  getReadPointers,
  addParticipant,
  kickParticipant,
  leaveConversation,
  updateParticipantRole,
  deleteConversation,
}
