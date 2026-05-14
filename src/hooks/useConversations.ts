import { useState, useEffect, useCallback } from 'react'
import { getAllConversations } from '../services/api/conversations'
import type { ConversationType } from '../utils/baseTypes'

const useConversations = () => {
  const [conversations, setConversations] = useState<ConversationType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await getAllConversations()
      setConversations(data)
      setError(null)
    } catch (error) {
      console.error('Error fetching conversations:', error)
      setError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    await fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    void fetchConversations()
  }, [fetchConversations])

  return { conversations, isLoading, error, refetch }
}

export default useConversations
