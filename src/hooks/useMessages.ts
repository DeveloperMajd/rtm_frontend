import { useEffect } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { getMessagesByConversationId } from '../services/api/messages'
import { markConversationAsRead } from '../services/api/conversations'
import type { ConversationType, MessageType } from '../utils/baseTypes'
import useEcho from './useEcho'

type MessagesResponse = {
  data: MessageType[]
  meta: { last_page: number; current_page: number }
}

type ConversationsResponse = { data: ConversationType[] }

const useMessages = (conversationId: string) => {
  const queryClient = useQueryClient()
  const echo = useEcho()

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useInfiniteQuery({
      queryKey: ['messages', conversationId],
      queryFn: ({ pageParam }) => getMessagesByConversationId(conversationId, pageParam),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.meta.current_page < lastPage.meta.last_page
          ? lastPage.meta.current_page + 1
          : undefined,
    })

  useEffect(() => {
    const markRead = () => {
      markConversationAsRead(conversationId)
        .then(() => {
          queryClient.setQueryData<ConversationsResponse>(['conversations'], (old) => {
            if (!old) return old
            return {
              ...old,
              data: old.data.map((c) =>
                c.id === conversationId ? { ...c, unread_count: 0 } : c,
              ),
            }
          })
        })
        .catch(() => {})
    }

    markRead()

    const channel = echo
      .private(`conversation.${conversationId}`)
      .listen('MessageSent', (message: MessageType) => {
        // The most recently fetched page is always the newest batch of
        // messages, regardless of how many older pages have since been
        // loaded via loadOlder — so a live message is always appended there.
        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
          ['messages', conversationId],
          (old) => {
            if (!old) return old
            const [latest, ...older] = old.pages
            if (latest.data.some((m) => m.id === message.id)) return old
            return {
              ...old,
              pages: [{ ...latest, data: [...latest.data, message] }, ...older],
            }
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

        // Already viewing this conversation, so the just-arrived message
        // counts as read too — advance the server-side read pointer.
        markRead()
      })
      .listen('MessageReactionUpdated', (updatedMessage: MessageType) => {
        // A reaction can land on a message from any loaded page (not just
        // the newest one), so every page has to be searched for it.
        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
          ['messages', conversationId],
          (old) => {
            if (!old) return old
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data.map((m) => (m.id === updatedMessage.id ? updatedMessage : m)),
              })),
            }
          },
        )
      })
      .listen('MessageUpdated', (updatedMessage: MessageType) => {
        // An edit or a delete (redaction) can land on a message from any
        // loaded page, so every page has to be searched for it. Any other
        // message quoting this one as a reply carries its own snapshot of
        // it, so that snapshot needs patching too or a delete would leave a
        // stale, un-redacted reply preview behind.
        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
          ['messages', conversationId],
          (old) => {
            if (!old) return old
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data.map((m) => {
                  if (m.id === updatedMessage.id) return updatedMessage
                  if (m.reply_to?.id === updatedMessage.id) {
                    return {
                      ...m,
                      reply_to: {
                        ...m.reply_to,
                        body: updatedMessage.body,
                        deleted_at: updatedMessage.deleted_at,
                      },
                    }
                  }
                  return m
                }),
              })),
            }
          },
        )
      })

    return () => {
      channel.stopListening('MessageSent')
      channel.stopListening('MessageReactionUpdated')
      channel.stopListening('MessageUpdated')
      echo.leave(`conversation.${conversationId}`)
    }
  }, [conversationId, echo, queryClient])

  const messages: MessageType[] = data
    ? [...data.pages].reverse().flatMap((page) => page.data)
    : []

  return {
    messages,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    error: error as Error | null,
    loadOlder: () => { void fetchNextPage() },
  }
}

export default useMessages
