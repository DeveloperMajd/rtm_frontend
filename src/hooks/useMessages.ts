import { useState, useEffect } from 'react'
import type { MessageType } from '../utils/baseTypes'
import { getMessagesByConversationId } from '../services/api/messages'

const useMessages = (conversationId: number) => {
  const [messages, setMessages] = useState<MessageType[]>([])
  console.log('🚀 ~ useMessages.ts:7 ~ useMessages ~ messages:', messages)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await getMessagesByConversationId(conversationId)
        setMessages(data.data)
      } catch (error) {
        console.error('Error fetching messages:', error)
        setError(error as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [conversationId])

  return { messages, isLoading, error }
}

export default useMessages
