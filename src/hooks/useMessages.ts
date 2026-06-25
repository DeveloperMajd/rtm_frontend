import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMessagesByConversationId } from '../services/api/messages'
import type { ConversationType, MessageType } from '../utils/baseTypes'
import useEcho from './useEcho'

type MessagesResponse = {
  data: MessageType[]
  meta: { last_page: number; current_page: number }
}

type ConversationsResponse = { data: ConversationType[] }

const useMessages = (conversationId: string) => {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const echo = useEcho()

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['messages', conversationId, page],
    queryFn: () => getMessagesByConversationId(conversationId, page),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    const channel = echo
      .private(`conversation.${conversationId}`)
      .listen('MessageSent', (message: MessageType) => {
        queryClient.setQueryData<MessagesResponse>(
          ['messages', conversationId, 1],
          (old) => {
            if (!old) return old
            if (old.data.some((m) => m.id === message.id)) return old
            return { ...old, data: [...old.data, message] }
          },
        )

        queryClient.setQueryData<ConversationsResponse>(
          ['conversations'],
          (old) => {
            if (!old) return old
            return {
              ...old,
              data: old.data.map((c) =>
                c.id === conversationId
                  ? {
                      ...c,
                      last_message_at: message.created_at,
                      latest_message: {
                        body: message.body,
                        sender_name: message.sender.name,
                      },
                    }
                  : c,
              ),
            }
          },
        )
      })

    return () => {
      channel.stopListening('MessageSent')
      echo.leave(`conversation.${conversationId}`)
    }
  }, [conversationId, echo, queryClient])

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
      const pageData = queryClient.getQueryData<MessagesResponse>([
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
