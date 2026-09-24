import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { MessageType } from './baseTypes'

export type MessagesPage = {
  data: MessageType[]
  meta: { has_more: boolean; next_before_id: string | null }
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
 * Appends a message to the cached newest page, if it isn't already held.
 *
 * Shared by the live Echo handler and the composer's own send, so a message
 * the viewer just sent shows up the moment the server confirms it rather
 * than waiting for the round trip back through the queue and Reverb.
 *
 * Returns false only when there's no cache to patch (nothing has loaded this
 * conversation yet), so the caller can fall back to a fetch.
 */
export function appendMessageToCache(
  queryClient: QueryClient,
  conversationId: string,
  message: MessageType,
): boolean {
  let applied = false

  queryClient.setQueryData<InfiniteData<MessagesPage>>(
    ['messages', conversationId],
    (old) => {
      if (!old || old.pages.length === 0) return old

      applied = true

      // Every page is searched, not just the newest: after offset drift the
      // same message can already be sitting on an older page.
      if (old.pages.some((page) => page.data.some((m) => m.id === message.id))) {
        return old
      }

      const [latest, ...older] = old.pages
      return { ...old, pages: [{ ...latest, data: [...latest.data, message] }, ...older] }
    },
  )

  return applied
}

/**
 * Rewrites one message wherever it's loaded, and brings along the snapshot
 * any reply holds of it.
 *
 * An edit or a delete can land on a message from any loaded page, so every
 * page is searched. A reply carries its own copy of the message it quotes;
 * without refreshing that copy, deleting a message would leave its text
 * readable in every reply to it.
 */
export function patchMessageInCache(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  patch: (message: MessageType) => MessageType,
): void {
  queryClient.setQueryData<InfiniteData<MessagesPage>>(
    ['messages', conversationId],
    (old) => {
      if (!old) return old

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
