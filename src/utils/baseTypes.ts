export type UserType = {
  id: string
  name: string
  email: string
  avatar_url?: string | null
  bio?: string | null
  is_online?: boolean
  last_seen_at?: string | null
}

export type PersonRef = {
  id: string
  name: string
  avatar_url?: string | null
}

export type ConversationType = {
  id: string
  type: 'group' | 'direct'
  title?: string
  created_by_user_id: string
  last_message_at?: string
  /** Set when the current user has left / been removed from this group. */
  viewer_left_at?: string | null
  other_participant?: {
    id: string
    name: string
    avatar_url?: string | null
    is_online: boolean
    last_seen_at?: string | null
  } | null
  latest_message?: {
    body: string
    sender_name: string
  }
  participants?: {
    user_id: string
    name: string
    avatar_url?: string | null
    role: string
    left_at?: string | null
    is_online: boolean
    last_seen_at?: string | null
  }[]
  participants_count?: number
  unread_count?: number
  created_at: string
  updated_at: string
}

export type ReactionType = {
  id: string
  reaction: string
  user: {
    id: string
    name: string
    avatar_url?: string | null
  }
}

export type AttachmentType = {
  id: string
  message_id: string | null
  original_name: string
  mime_type: string
  size_bytes: number
  width?: number | null
  height?: number | null
  duration_ms?: number | null
  is_image: boolean
  url: string
  created_at: string
}

/** Group event descriptors carried on system messages. */
export type SystemEventType =
  | 'group_created'
  | 'group_renamed'
  | 'member_added'
  | 'member_left'
  | 'member_removed'
  | 'member_promoted'
  | 'member_demoted'

export type MessageType = {
  id: string
  conversation_id: string
  /**
   * 'user' for a normal message, 'system' for a group event line. Optional for
   * back-compat; treated as 'user' when absent. System messages have a null
   * `sender` and carry `event_type` + `metadata` instead — `Messages` routes
   * those to `SystemMessage` so `MessageItem` only ever sees real messages.
   */
  type?: 'user' | 'system'
  event_type?: SystemEventType
  metadata?: Record<string, unknown>
  sender: {
    id: string
    name: string
    avatar_url?: string | null
  } | null
  body: string
  reactions: ReactionType[]
  attachments?: AttachmentType[]
  attachments_count?: number
  reply_to_message_id?: string
  reply_to?: {
    id: string
    body: string
    deleted_at?: string
    sender: {
      id: string
      name: string
      avatar_url?: string | null
    } | null
  } | null
  edited_at?: string
  deleted_at?: string

  created_at: string
  updated_at: string
}

export type MessageSearchResultType = {
  id: string
  conversation_id: string
  conversation_title?: string
  body: string
  sender: {
    id: string
    name: string
    avatar_url?: string | null
  }
  created_at: string
}
