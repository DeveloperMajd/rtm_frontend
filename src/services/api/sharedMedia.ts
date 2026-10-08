import api from './axios'
import type { AttachmentType } from '../../utils/baseTypes'

/** The photos, or everything else, as the info panel lists them apart. */
export type SharedKind = 'media' | 'files'

/** A photo or file in a conversation: the attachment as its message carries
 * it, and who sent it when (the list gathers many messages' attachments). */
export type SharedAttachment = AttachmentType & {
  sender: { id: string; name: string; avatar_url?: string | null } | null
  sent_at: string
}

export type SharedMediaPage = {
  data: SharedAttachment[]
  meta: { total: number; has_more: boolean; next_before_id: string | null }
}

/** A page of a conversation's shared photos or files, newest first: the
 * newest, or those older than `beforeId` (an attachment's id). Only what
 * the viewer can see in the history. */
const getSharedMedia = async (
  conversationId: string,
  kind: SharedKind,
  beforeId: string | null,
  limit: number,
): Promise<SharedMediaPage> => {
  const response = await api.get<SharedMediaPage>(`/conversations/${conversationId}/attachments`, {
    params: { kind, limit, ...(beforeId ? { before_id: beforeId } : {}) },
  })
  return response.data
}

export { getSharedMedia }
