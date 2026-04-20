export type ConversationType = {
  id: number
  type: 'group' | 'direct'
  title?: string
  created_by_user_id: number
  last_message_at?: string
  created_at: string
  updated_at: string
}

export type MessageType = {
  id: number
  conversation_id: number
  sender_user_id: number
  body: string //TODO: change it to content in backend and frontend
  created_at: string
  updated_at: string
}
