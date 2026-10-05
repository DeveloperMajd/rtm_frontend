import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { MessageType } from './baseTypes'

export type MessagesPage = {
  data: MessageType[]
  meta: {
    /** There is older history beyond this page. */
    has_more: boolean
    /** Where to continue reading backwards from (null when has_more is false). */
    next_before_id: string | null
    /**
     * Where to continue reading forwards from, when this page doesn't reach
     * the newest message — only ever set on a window opened somewhere in the
     * middle of the history (a jump to a message). Absent or null on the
     * newest page, which is what makes a window "live".
     */
    next_after_id?: string | null
  }
}

/**
 * One cached window of a conversation's history. The newest page comes
 * first, as fetchNextPage appends older pages behind it and fetchPreviousPage
 * puts newer ones in front.
 *
 * A conversation can have more than one window cached at once: the one that
 * ends at its newest message, and one opened around a message the viewer
 * jumped to. Each has its own query key under ['messages', conversationId].
 */
export type MessagesWindow = InfiniteData<MessagesPage>

/** Every cached window of one conversation's history. */
export const messagesKey = (conversationId: string) => ['messages', conversationId] as const

/**
 * Does this window reach the newest message? Only such a window may take
 * live messages: appended to one that stops short, a message would sit
 * directly under an older one with everything in between missing, and
 * nothing would say so.
 */
export function isLiveWindow(window: MessagesWindow): boolean {
  return !window.pages[0]?.meta.next_after_id
}

/** Skips cache entries under the prefix that aren't windows of history. */
function isWindow(value: unknown): value is MessagesWindow {
  return typeof value === 'object' && value !== null && Array.isArray((value as MessagesWindow).pages)
}

/**
 * Flattens the infinite query's pages into one oldest-to-newest list,
 * dropping duplicates and restoring a strict chronological order.
 *
 * The API pages by cursor now, so pages no longer overlap of their own
 * accord. This began as a repair for offset pagination, which handed the same
 * message back on two different pages once the list grew underneath it
 * (duplicate React keys, and a divider that counted backwards over phantom
 * messages). It stays as a safety net for the one case a cursor cannot rule
 * out: a live Echo append racing the fetch that was already bringing the same
 * message down.
 *
 * Ids are UUIDv7 — monotonic and lexicographically ordered by time, which is
 * exactly what the server orders by — so sorting by id yields the true order
 * regardless of which page a copy arrived on, over a window that is only ever
 * a few hundred messages.
 */
export function flattenMessagePages(pages: MessagesPage[]): MessageType[] {
  const byId = new Map<string, MessageType>()

  // Walk oldest page first so that the newest page's copy of a duplicated
  // message wins: the first page is the one live appends and edits are
  // patched into.
  for (let i = pages.length - 1; i >= 0; i--) {
    for (const message of pages[i].data) {
      byId.set(message.id, message)
    }
  }

  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Appends a message to the newest page of every live window of the
 * conversation (see isLiveWindow), if it isn't already held.
 *
 * Shared by the live Echo handler and the composer's own send, so a message
 * the viewer just sent shows up the moment the server confirms it rather
 * than waiting for the round trip back through the queue and Reverb.
 *
 * Returns false only when nothing of the conversation is cached at all (it
 * hasn't loaded here yet), so the caller can fall back to a fetch. A window
 * that stops short of the newest message is left alone but still counts as
 * cached: it catches up by reading forwards, and fetching it again wouldn't
 * put the message in it either.
 */
export function appendMessageToCache(
  queryClient: QueryClient,
  conversationId: string,
  message: MessageType,
): boolean {
  let cached = false

  queryClient.setQueriesData<MessagesWindow>({ queryKey: messagesKey(conversationId) }, (old) => {
    if (!isWindow(old) || old.pages.length === 0) return old

    cached = true
    if (!isLiveWindow(old)) return old

    // Every page is searched, not just the newest: after offset drift the
    // same message can already be sitting on an older page.
    if (old.pages.some((page) => page.data.some((m) => m.id === message.id))) {
      return old
    }

    const [latest, ...older] = old.pages
    return { ...old, pages: [{ ...latest, data: [...latest.data, message] }, ...older] }
  })

  return cached
}

/**
 * Rewrites one message wherever it's loaded, and brings along the snapshot
 * any reply holds of it.
 *
 * An edit or a delete can land on a message from any loaded page, in any
 * cached window, so every page of every window is searched. A reply carries its own copy of the message it quotes;
 * without refreshing that copy, deleting a message would leave its text
 * readable in every reply to it.
 */
export function patchMessageInCache(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  patch: (message: MessageType) => MessageType,
): void {
  queryClient.setQueriesData<MessagesWindow>(
    { queryKey: messagesKey(conversationId) },
    (old) => {
      if (!isWindow(old)) return old

      let patched: MessageType | undefined
      const pages = old.pages.map((page) => ({
        ...page,
        data: page.data.map((m) => {
          if (m.id !== messageId) return m
          patched = patch(m)
          return patched
        }),
      }))
      if (!patched) return old

      const { body, deleted_at } = patched
      return {
        ...old,
        pages: pages.map((page) => ({
          ...page,
          data: page.data.map((m) =>
            m.reply_to?.id === messageId ? { ...m, reply_to: { ...m.reply_to, body, deleted_at } } : m,
          ),
        })),
      }
    },
  )
}

/** Puts the server's current copy of a message into the cache — from the
 * live MessageUpdated event, or straight from an edit's own response so the
 * change shows without waiting for that event to come back round. */
export function replaceMessageInCache(
  queryClient: QueryClient,
  conversationId: string,
  message: MessageType,
): void {
  patchMessageInCache(queryClient, conversationId, message.id, () => message)
}

/**
 * Shows a message as deleted once the server has confirmed it (the delete
 * endpoint answers 204, with no body to copy). Mirrors what the server
 * itself does to the row — body cleared, attachments withheld — and leaves
 * a copy that's already marked deleted alone, so a MessageUpdated event
 * that got here first keeps the server's own timestamp.
 */
export function markMessageDeletedInCache(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
): void {
  patchMessageInCache(queryClient, conversationId, messageId, (m) =>
    m.deleted_at ? m : { ...m, body: '', attachments: [], deleted_at: new Date().toISOString() },
  )
}
