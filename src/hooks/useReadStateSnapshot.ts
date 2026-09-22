import { useState } from 'react'

export interface ReadStateSnapshot {
  /** How many messages were unread when the conversation was opened. */
  unreadCount: number
  /** The message the viewer had read up to at that moment — the anchor the
   * unread divider is drawn from. Null if they had never read it. */
  lastReadMessageId: string | null
}

/**
 * Captures a conversation's read state once, at the moment it's opened —
 * before useMessages's mark-as-read effect moves it on (server-side and in
 * the conversations cache). Used to place the unread divider where reading
 * was actually left off, rather than wherever it has since advanced to.
 *
 * Both halves have to be captured together: marking as read both zeroes
 * unread_count *and* advances last_read_message_id to the newest message, so
 * a divider anchored to a freshly-refetched anchor would sit below every
 * message and never be seen.
 *
 * Returns undefined until the conversations list this mount fetched for
 * itself has arrived (`conversationsReady`), so a direct navigation, a page
 * refresh, or a return from another route doesn't snapshot state left over
 * from an earlier visit — which, after messages have arrived in the meantime,
 * is usually a false zero.
 *
 * Uses state rather than a ref guard — React's documented "adjust state when
 * a prop changes" pattern, safe to call during render; a ref read/written
 * during render isn't (it can't be trusted to survive a discarded
 * speculative render pass the way state can).
 */
export function useReadStateSnapshot(
  conversationId: string | undefined,
  conversationsReady: boolean,
  unreadCount: number | undefined,
  lastReadMessageId: string | null | undefined,
): ReadStateSnapshot | undefined {
  const [snapshot, setSnapshot] = useState<ReadStateSnapshot | undefined>(undefined)
  const [snapshotForId, setSnapshotForId] = useState<string | undefined>(undefined)

  if (
    conversationsReady &&
    conversationId !== undefined &&
    snapshotForId !== conversationId
  ) {
    setSnapshotForId(conversationId)
    setSnapshot({
      unreadCount: unreadCount ?? 0,
      lastReadMessageId: lastReadMessageId ?? null,
    })
  }

  // Guarded by the id it was taken for: while switching conversations (and
  // before the new one's read state has arrived) the previous conversation's
  // snapshot must not leak through and place a divider in this one.
  return snapshotForId === conversationId ? snapshot : undefined
}
