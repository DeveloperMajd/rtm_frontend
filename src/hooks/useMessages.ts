import { useCallback, useEffect } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { getMessagesByConversationId } from '../services/api/messages'
import { markConversationAsRead } from '../services/api/conversations'
import type { ConversationType, MessageType } from '../utils/baseTypes'
import {
  appendMessageToCache,
  flattenMessagePages,
  type MessagesPage as MessagesResponse,
} from '../utils/messagePages'
import useEcho from './useEcho'

type ConversationsResponse = { data: ConversationType[] }

interface UseMessagesOptions {
  /**
   * Delay marking-as-read and the live Echo subscription until the
   * conversations list has loaded. Without this, opening a conversation
   * directly (a fresh page load, not navigated to from an already-loaded
   * list) races the two: `readOnly` defaults to false while conversations
   * are still loading, so mark-as-read can reach the server and zero the
   * read pointer *before* the conversations list's own fetch — the one
   * useUnreadSnapshot relies on to capture the pre-read count — ever
   * completes. That fetch then correctly, but unhelpfully, returns 0,
   * since the server-side state has already moved. Deferring here means
   * the snapshot (captured synchronously during render, before any
   * effect) always wins the race deterministically, not by timing luck.
   */
  deferUntilReady?: boolean
}

const useMessages = (conversationId: string, readOnly = false, options: UseMessagesOptions = {}) => {
  const { deferUntilReady = false } = options
  const queryClient = useQueryClient()
  const echo = useEcho()

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isFetchedAfterMount,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) => getMessagesByConversationId(conversationId, pageParam),
    // null = "the newest page"; every later page is anchored to the oldest id
    // of the one before it. On a refetch React Query re-derives each
    // subsequent cursor from the page it just fetched, so the refetched
    // window stays contiguous no matter how many messages arrived meanwhile.
    // Page numbers could not do that: re-deriving "page 2" over a list that
    // had grown returned rows page 1 already held.
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.next_before_id : undefined,
    // This cache is only trustworthy while the Echo subscription below is
    // live: that subscription is what keeps it current, and it's torn down
    // the moment the room unmounts. Anything that arrives while the viewer
    // is elsewhere lands in Postgres but never in this cache, so on the way
    // back in the cache is wrong however recently it was written — which the
    // app's global `staleTime: 30_000` would otherwise take as a reason NOT
    // to refetch, leaving those messages invisible until something else
    // happened to invalidate the query. Re-validate on every mount instead;
    // the cached pages still render immediately, so there's no flash.
    refetchOnMount: 'always',
    // And opt out of the app-wide staleTime for this query specifically.
    // refetchOnMount only governs an observer that *mounts*; switching
    // straight from one conversation to another keeps the same observer and
    // only swaps its key, and that path never consults refetchOnMount — it
    // asks `isStale()` alone. Under the global 30s staleTime the answer was
    // "still fresh", so going A → B → A refetched nothing and the room
    // showed whatever the previous visit had cached, minus every message
    // that had arrived since. Cached pages still render instantly; this only
    // decides whether to re-check the server, and here the answer is always.
    staleTime: 0,
  })

  useEffect(() => {
    // The final "you left"/"you were removed" system line is broadcast at
    // the moment it happens, but it can arrive (via the queue) after this
    // component has already flipped to read-only and torn down its Echo
    // subscription — missing it live. Refetch once so the frozen history
    // (which does include that line) replaces whatever was cached before.
    if (readOnly) {
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    }
  }, [readOnly, conversationId, queryClient])

  useEffect(() => {
    // A left/kicked member's history is frozen server-side and this channel
    // rejects their subscription anyway — nothing here can do anything for
    // them, so skip marking-as-read and the (doomed) Echo subscription.
    // deferUntilReady holds off the same two for a different reason — see
    // its own doc comment above.
    if (readOnly || deferUntilReady) return

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
        // A message the viewer sent themselves is usually already in the
        // cache by now (the composer patches it in from the send response),
        // in which case this is a no-op.
        appendMessageToCache(queryClient, conversationId, message)

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
                        type: message.type,
                        body: message.body,
                        sender_name: message.sender?.name ?? '',
                        event_type: message.event_type,
                        metadata: message.metadata,
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
  }, [conversationId, echo, queryClient, readOnly, deferUntilReady])

  // De-duplicated and re-sorted rather than a plain flatMap — see
  // flattenMessagePages for why offset pagination hands back overlapping
  // pages once a conversation is live.
  const messages: MessageType[] = data ? flattenMessagePages(data.pages) : []

  // Stable identity: useAutoLoadOlder puts this in a scroll-listener
  // effect's dependency array, and a fresh function reference on every
  // render would tear that listener down and re-add it constantly.
  const loadOlder = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])

  return {
    messages,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    error: error as Error | null,
    loadOlder,
    /**
     * A whole-query refetch is in flight (as opposed to paging in one more
     * page of history).
     *
     * Nothing may call loadOlder while this is true. Refetching an infinite
     * query rebuilds its entire `pages` array page by page; a fetchNextPage
     * that starts in the middle of that appends to the array as it was
     * *before* the rebuild, and whichever finishes last wins. When the page
     * fetch won, it wrote back the pre-refetch pages — permanently throwing
     * away the freshly-fetched first page and, with it, every message that
     * had arrived while the room was closed. That is the race behind
     * messages that never appeared and dividers anchored to a stale end of
     * the list, and it was intermittent precisely because it was a race.
     */
    isRefreshing: isFetching && !isFetchingNextPage,
    /**
     * True once this mount has fetched its own copy of the messages, rather
     * than only rendering what a previous visit left in the cache. The
     * unread divider waits for it: resolving the boundary against a stale
     * window freezes the divider at the wrong message, and every message
     * that arrives afterwards then piles up below it — the "NEW 4 with 8
     * messages under it" report.
     */
    isReady: isFetchedAfterMount,
  }
}

export default useMessages
