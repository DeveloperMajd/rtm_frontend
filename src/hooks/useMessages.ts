import { useCallback, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getMessagesPage, type MessagesPageParam } from '../services/api/messages'
import { markConversationAsRead, type ReadPointer } from '../services/api/conversations'
import type { ConversationType, MessageType } from '../utils/baseTypes'
import {
  appendMessageToCache,
  flattenMessagePages,
  messagesKey,
  replaceMessageInCache,
} from '../utils/messagePages'
import { applyReadPointer, messageInfoKey } from '../utils/readReceipts'
import { sharedMediaKey } from './useSharedMedia'
import { isViewing } from '../utils/viewing'
import useEcho from './useEcho'
import useAuth from './useAuth'
import { currentSettings } from './useSettings'

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
  /** False for a conversation that isn't there (deleted, or a bad link):
   * nothing to fetch, mark read or subscribe to. */
  enabled?: boolean
  /**
   * Open the history around this message instead of at the newest one — a
   * jump to a reply's original or a search result that isn't loaded. The
   * window reads older and newer from there, and becomes the live one once
   * it has caught up with the newest message.
   */
  anchor?: string | null
}

/** Not worth retrying: the message isn't there for this viewer, and asking
 * again won't change that. */
const isGone = (error: unknown) =>
  isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 404)

/** Live messages held for a window that hasn't caught up yet, at most. */
const PENDING_LIMIT = 200

/** A burst of messages is read in one go: one request, one broadcast. */
export const MARK_READ_DEBOUNCE_MS = 750

const useMessages = (conversationId: string, readOnly = false, options: UseMessagesOptions = {}) => {
  const { deferUntilReady = false, enabled = true, anchor = null } = options
  const queryClient = useQueryClient()
  const echo = useEcho()
  const viewerId = useAuth().user?.id

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    isFetchedAfterMount,
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    isFetchNextPageError,
    isFetchPreviousPageError,
    refetch,
    error,
  } = useInfiniteQuery({
    // One window per place the history was opened at: the newest messages,
    // or around a message jumped to. See MessagesWindow.
    queryKey: [...messagesKey(conversationId), anchor ?? 'latest'],
    queryFn: ({ pageParam }) => getMessagesPage(conversationId, pageParam),
    // Every page after the first is anchored to a message id at the edge of
    // the one before it: its oldest for older history, its newest for newer.
    // On a refetch React Query re-derives each subsequent cursor from the
    // page it just fetched, so the refetched window stays contiguous no
    // matter how many messages arrived meanwhile. Page numbers could not do
    // that: re-deriving "page 2" over a list that had grown returned rows
    // page 1 already held.
    initialPageParam: (anchor ? { kind: 'around', id: anchor } : { kind: 'latest' }) as MessagesPageParam,
    getNextPageParam: (lastPage): MessagesPageParam | undefined =>
      lastPage.meta.has_more && lastPage.meta.next_before_id
        ? { kind: 'older', before: lastPage.meta.next_before_id }
        : undefined,
    // Only a window opened around a jump has newer pages to read: the
    // newest page has no next_after_id.
    getPreviousPageParam: (firstPage): MessagesPageParam | undefined =>
      firstPage.meta.next_after_id ? { kind: 'newer', after: firstPage.meta.next_after_id } : undefined,
    retry: (failureCount, err) => !isGone(err) && failureCount < 1,
    // This cache is only trustworthy while the Echo subscription below is
    // live: that subscription is what keeps it current, and it's torn down
    // the moment the room unmounts. Anything that arrives while the viewer
    // is elsewhere lands in Postgres but never in this cache, so on the way
    // back in the cache is wrong however recently it was written — which the
    // app's global `staleTime: 30_000` would otherwise take as a reason NOT
    // to refetch, leaving those messages invisible until something else
    // happened to invalidate the query. Re-validate on every mount instead
    // (and see gcTime below: the cache no longer outlives the room anyway).
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
    // Nor is a closed conversation's cache worth keeping at all: showing it
    // again meant a stale list (from the top, since it wasn't positioned
    // yet) until every page it held had been fetched again, one request
    // each, and then a jump to the bottom. Dropped as the room closes, the
    // next visit starts from the newest page behind the loading skeleton.
    gcTime: 0,
    enabled,
  })

  useEffect(() => {
    // The final "you left"/"you were removed" system line is broadcast at
    // the moment it happens, but it can arrive (via the queue) after this
    // component has already flipped to read-only and torn down its Echo
    // subscription — missing it live. Refetch once so the frozen history
    // (which does include that line) replaces whatever was cached before.
    if (readOnly) {
      void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) })
    }
  }, [readOnly, conversationId, queryClient])

  // De-duplicated and re-sorted rather than a plain flatMap — see
  // flattenMessagePages for why offset pagination hands back overlapping
  // pages once a conversation is live.
  const messages: MessageType[] = data ? flattenMessagePages(data.pages) : []

  // A window opened around a jump doesn't reach the newest message yet, so a
  // live message can't go into it (see isLiveWindow) — but it mustn't be
  // lost either. The window catches up by reading forwards, and a message
  // committed just after the last of those reads was answered would be in
  // neither that answer nor the window. Held here, and added once the
  // window has caught up; anything the reads already brought is de-duplicated.
  const hasNewer = hasPreviousPage
  const hasNewerRef = useRef(hasNewer)
  const pendingLiveRef = useRef<MessageType[]>([])

  useEffect(() => {
    hasNewerRef.current = hasNewer
    if (hasNewer || pendingLiveRef.current.length === 0) return
    for (const message of pendingLiveRef.current) {
      appendMessageToCache(queryClient, conversationId, message)
    }
    pendingLiveRef.current = []
  }, [hasNewer, queryClient, conversationId])

  // Opening a different window starts it from a fresh read, which already
  // includes everything held for the one before.
  useEffect(() => {
    pendingLiveRef.current = []
  }, [anchor])

  useEffect(() => {
    // A left/kicked member's history is frozen server-side and this channel
    // rejects their subscription anyway — nothing here can do anything for
    // them, so skip marking-as-read and the (doomed) Echo subscription.
    // deferUntilReady holds off the same two for a different reason — see
    // its own doc comment above.
    if (readOnly || deferUntilReady || !enabled) return

    // A held message edited, deleted or reacted to before it's added.
    const replacePending = (updated: MessageType) => {
      pendingLiveRef.current = pendingLiveRef.current.map((m) => (m.id === updated.id ? updated : m))
    }

    const channel = echo
      .private(`conversation.${conversationId}`)
      .listen('MessageSent', (message: MessageType) => {
        // Into the newest page of the window that reaches the newest
        // message, however many older pages have since been loaded; held
        // instead while this one doesn't reach it yet (see pendingLiveRef).
        // A message the viewer sent themselves is usually already in the
        // cache by now (the composer patches it in from the send response),
        // in which case this is a no-op.
        appendMessageToCache(queryClient, conversationId, message)
        if (hasNewerRef.current) {
          pendingLiveRef.current = [...pendingLiveRef.current, message].slice(-PENDING_LIMIT)
        }
        // New photos or files: the info panel's shared media, if it's open.
        if (message.attachments_count) {
          void queryClient.invalidateQueries({ queryKey: sharedMediaKey(conversationId) })
        }

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
                      // Someone else's message that arrives while the viewer
                      // isn't looking stays unread until they are (see the
                      // marking below), and the list says so meanwhile.
                      unread_count:
                        message.type !== 'system' && message.sender?.id !== viewerId && !isViewing()
                          ? (c.unread_count ?? 0) + 1
                          : c.unread_count,
                      // The server brings an archived conversation back with
                      // someone else's message unless it's muted; so here.
                      archived_at:
                        message.type !== 'system' && message.sender?.id !== viewerId && !c.muted_at
                          ? null
                          : c.archived_at,
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

      })
      .listen('MessageReactionUpdated', (updatedMessage: MessageType) => {
        // A reaction can land on a message from any loaded page (not just
        // the newest one), in any cached window.
        replaceMessageInCache(queryClient, conversationId, updatedMessage)
        replacePending(updatedMessage)
      })
      .listen('MessageUpdated', (updatedMessage: MessageType) => {
        // An edit or a delete (redaction), on any loaded page — including
        // the snapshot every reply holds of it (see patchMessageInCache).
        replaceMessageInCache(queryClient, conversationId, updatedMessage)
        replacePending(updatedMessage)
        // A deleted message's photos and files leave the shared media too.
        if (updatedMessage.deleted_at && updatedMessage.attachments_count) {
          void queryClient.invalidateQueries({ queryKey: sharedMediaKey(conversationId) })
        }
      })
      .listen('ConversationRead', (pointer: ReadPointer) => {
        // Someone read further: "Sent" becomes "Seen" (see useReadPointers).
        // Not for a viewer who doesn't share their own read state: read
        // receipts work both ways, as the server's own list of pointers does.
        if (!currentSettings(queryClient).read_receipts) return
        applyReadPointer(queryClient, conversationId, pointer)
        // A "Message info" that's open lists who has seen a message: ask the
        // server again, since it's the one that knows who counts.
        void queryClient.invalidateQueries({ queryKey: messageInfoKey(conversationId) })
      })

    return () => {
      channel.stopListening('MessageSent')
      channel.stopListening('MessageReactionUpdated')
      channel.stopListening('MessageUpdated')
      channel.stopListening('ConversationRead')
      echo.leave(`conversation.${conversationId}`)
    }
  }, [conversationId, echo, queryClient, readOnly, deferUntilReady, enabled, viewerId])


  // --- Marking as read ---
  //
  // Up to the newest message the viewer has in front of them — the end of
  // this window, which is the conversation's newest message unless they've
  // jumped back into its history — and only while they're actually looking:
  // the tab visible and focused. A message that arrives in a background tab
  // stays unread until they come back, rather than reading as "Seen" to
  // whoever sent it. Debounced, so a burst of messages costs one request and
  // one broadcast rather than one each; and a pointer already reported isn't
  // sent again. (The server never moves a pointer back, either.)
  const newestLoadedId = messages.at(-1)?.id
  const reportedReadRef = useRef<string | null>(null)

  useEffect(() => {
    // A member who has left reads a frozen history; deferUntilReady holds
    // this off for the reason in its own doc comment.
    if (readOnly || deferUntilReady || !enabled || !newestLoadedId) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const markRead = () => {
      const reported = reportedReadRef.current
      if (!isViewing() || (reported !== null && reported >= newestLoadedId)) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        const reachesNewest = !hasNewerRef.current
        markConversationAsRead(conversationId, newestLoadedId)
          .then(() => {
            if (reportedReadRef.current === null || newestLoadedId > reportedReadRef.current) {
              reportedReadRef.current = newestLoadedId
            }
            if (!reachesNewest) return
            queryClient.setQueryData<ConversationsResponse>(['conversations'], (old) => {
              if (!old) return old
              return {
                ...old,
                data: old.data.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
              }
            })
          })
          .catch(() => {})
      }, MARK_READ_DEBOUNCE_MS)
    }

    markRead()
    // Coming back to the tab, or to the window, is when a waiting message
    // gets read.
    document.addEventListener('visibilitychange', markRead)
    window.addEventListener('focus', markRead)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', markRead)
      window.removeEventListener('focus', markRead)
    }
  }, [conversationId, newestLoadedId, readOnly, deferUntilReady, enabled, queryClient])

  // Stable identity: useAutoLoadOlder puts this in a scroll-listener
  // effect's dependency array, and a fresh function reference on every
  // render would tear that listener down and re-add it constantly.
  const loadOlder = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])

  const loadNewer = useCallback(() => {
    void fetchPreviousPage()
  }, [fetchPreviousPage])

  return {
    messages,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    error: error as Error | null,
    /** Paging in older history failed — what's loaded is still good. */
    isOlderError: isFetchNextPageError,
    retry: () => void refetch(),
    loadOlder,
    /**
     * This window stops short of the newest message: it was opened around a
     * jump and hasn't caught up yet. Live messages aren't shown in it until
     * it has (see the pending note above).
     */
    hasNewer,
    isLoadingNewer: isFetchingPreviousPage,
    /** Reading forwards towards the newest message failed. */
    isNewerError: isFetchPreviousPageError,
    loadNewer,
    /**
     * A whole-query refetch is in flight (as opposed to paging in one more
     * page of history).
     *
     * Nothing may call loadOlder (or loadNewer) while this is true. Refetching an infinite
     * query rebuilds its entire `pages` array page by page; a fetchNextPage
     * that starts in the middle of that appends to the array as it was
     * *before* the rebuild, and whichever finishes last wins. When the page
     * fetch won, it wrote back the pre-refetch pages — permanently throwing
     * away the freshly-fetched first page and, with it, every message that
     * had arrived while the room was closed. That is the race behind
     * messages that never appeared and dividers anchored to a stale end of
     * the list, and it was intermittent precisely because it was a race.
     */
    isRefreshing: isFetching && !isFetchingNextPage && !isFetchingPreviousPage,
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
