import api from './axios'
import type { MessageType } from '../../utils/baseTypes'

/**
 * One message under Saved: when it was saved, the message as the history
 * shows it (with its sender and attachments, without reactions or the
 * message it replies to), and the conversation it's in, by name — a
 * group's title, or the other person's (null if their account is gone).
 */
export type SavedMessage = {
  id: string
  saved_at: string
  message: Omit<MessageType, 'reactions'>
  conversation: { id: string; type: 'direct' | 'group'; title: string | null }
}

export type SavedMessagesPage = {
  data: SavedMessage[]
  meta: { has_more: boolean; next_before_id: string | null }
}

/** A page of the saved list, most recently saved first: the newest, or
 * those saved before `beforeId` (a save's id, from the page before). */
const getSavedMessages = async (beforeId: string | null): Promise<SavedMessagesPage> => {
  const response = await api.get<SavedMessagesPage>('/saved-messages', {
    params: beforeId ? { before_id: beforeId } : undefined,
  })
  return response.data
}

/** The ids of every message the viewer has saved, for the message menu. */
const getSavedMessageIds = async (): Promise<string[]> => {
  const response = await api.get<{ data: string[] }>('/saved-messages/ids')
  return response.data.data
}

/** Saving twice, or removing what isn't saved, changes nothing. */
const saveMessage = async (messageId: string): Promise<void> => {
  await api.post(`/messages/${messageId}/save`)
}

const unsaveMessage = async (messageId: string): Promise<void> => {
  await api.delete(`/messages/${messageId}/save`)
}

export { getSavedMessages, getSavedMessageIds, saveMessage, unsaveMessage }
