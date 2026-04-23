import { useCallback, useEffect, useState } from 'react'
import type { MessageType } from '../utils/baseTypes'
import { getMessagesByConversationId } from '../services/api/messages'

const useMessages = (conversationId: number) => {
  const [messages, setMessages] = useState<MessageType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getMessagesByConversationId(conversationId)
      setMessages(data.data)
      setError(null)
    } catch (error) {
      console.error('Error fetching messages:', error)
      setError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    await fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refetch()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [refetch])

  return { messages, isLoading, error, refetch }
}

export default useMessages
