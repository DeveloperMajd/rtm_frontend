export type UserType = {
  id: string
  name: string
  email: string
  is_online?: boolean
  last_seen_at?: string | null
}

export type ConversationType = {
  id: string
  type: 'group' | 'direct'
  title?: string
  created_by_user_id: string
  last_message_at?: string
  other_participant?: {
    id: string
    name: string
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
    role: string
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
  }
}

export type MessageType = {
  id: string
  conversation_id: string
  sender: {
    id: string
    name: string
  }
  body: string
  reactions: ReactionType[]
  reply_to_message_id?: string
  reply_to?: {
    id: string
    body: string
    deleted_at?: string
    sender: {
      id: string
      name: string
    }
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
  }
  created_at: string
}
