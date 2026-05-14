import { useCallback, useEffect, useState } from 'react'
import type { MessageType } from '../utils/baseTypes'
import { getMessagesByConversationId } from '../services/api/messages'

const useMessages = (conversationId: number) => {
  const [messages, setMessages] = useState<MessageType[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const response = await getMessagesByConversationId(conversationId, 1)
      setMessages(response.data)
      setCurrentPage(1)
      setLastPage(response.meta.last_page)
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

  const loadOlder = useCallback(async () => {
    if (currentPage >= lastPage) return
    setIsLoadingMore(true)
    try {
      const nextPage = currentPage + 1
      const response = await getMessagesByConversationId(conversationId, nextPage)
      setMessages((prev) => [...response.data, ...prev])
      setCurrentPage(nextPage)
    } catch (error) {
      console.error('Error loading older messages:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [conversationId, currentPage, lastPage])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refetch()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [refetch])

  return {
    messages,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    loadOlder,
    hasMore: currentPage < lastPage,
  }
}

export default useMessages
