export type UserType = {
  id: number
  name: string
}

export type ConversationType = {
  id: number
  type: 'group' | 'direct'
  title?: string
  created_by_user_id: number
  last_message_at?: string
  latest_message?: {
    body: string
    sender_name: string
  }
  created_at: string
  updated_at: string
}

export type MessageType = {
  id: number
  conversation_id: number
  sender: {
    id: number
    name: string
  }
  body: string

  created_at: string
  updated_at: string
}
