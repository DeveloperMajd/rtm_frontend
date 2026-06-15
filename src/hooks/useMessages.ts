import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMessagesByConversationId } from '../services/api/messages'
import type { MessageType } from '../utils/baseTypes'

const useMessages = (conversationId: string) => {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['messages', conversationId, page],
    queryFn: () => getMessagesByConversationId(conversationId, page),
    placeholderData: (prev) => prev,
  })

  const loadOlder = () => {
    if (page < (data?.meta.last_page ?? 1)) {
      setPage((p) => p + 1)
    }
  }

  const allMessages: MessageType[] = (() => {
    if (!data) return []
    if (page === 1) return data.data
    const cached: MessageType[] = []
    for (let p = page; p >= 1; p--) {
      const pageData = queryClient.getQueryData<typeof data>([
        'messages',
        conversationId,
        p,
      ])
      if (pageData) cached.push(...pageData.data)
    }
    return cached
  })()

  return {
    messages: allMessages,
    isLoading,
    isLoadingMore: page > 1 && isFetching,
    hasMore: page < (data?.meta.last_page ?? 1),
    error: error as Error | null,
    loadOlder,
  }
}

export default useMessages
