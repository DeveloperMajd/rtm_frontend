export type UserType = {
  id: string
  name: string
  email: string
}

export type ConversationType = {
  id: string
  type: 'group' | 'direct'
  title?: string
  created_by_user_id: string
  last_message_at?: string
  latest_message?: {
    body: string
    sender_name: string
  }
  created_at: string
  updated_at: string
}

export type MessageType = {
  id: string
  conversation_id: string
  sender: {
    id: string
    name: string
  }
  body: string

  created_at: string
  updated_at: string
}
