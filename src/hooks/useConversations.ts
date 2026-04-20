import { useState, useEffect } from 'react'
import { getAllConversations } from '../services/api/conversations'
import type { ConversationType } from '../utils/baseTypes'

const useConversations = () => {
  const [conversations, setConversations] = useState<ConversationType[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await getAllConversations()
        setConversations(data)
      } catch (error) {
        console.error('Error fetching conversations:', error)
        setError(error as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [])

  return { conversations, isLoading, error }
}

export default useConversations
