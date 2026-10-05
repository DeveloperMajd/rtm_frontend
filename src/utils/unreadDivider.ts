import type { MessageType } from './baseTypes'

/**
 * Whether a message counts towards unread_count, matching the server's own
 * definition (ConversationResource::unread_count): only `type: 'user'`
 * messages that someone else sent.
 */
function countsAsUnread(message: MessageType, viewerId: string | undefined): boolean {
  return message.type !== 'system' && message.sender?.id !== viewerId
}

export interface UnreadBoundaryResolution {
  /** undefined = not enough history loaded yet to decide either way; null =
   * confirmed there is no divider to show; a string = the id of the first
   * unread message, which the divider is drawn above. */
  boundaryId: string | null | undefined
  /** True when more history should be loaded before deciding. */
  needsMore: boolean
}

/**
 * Works out which message the "new messages" divider belongs above.
 *
 * Anchored on `lastReadMessageId` — the exact message the server counted
 * unread_count from. The divider then goes above the oldest loaded message
 * newer than it that counts as unread.
 *
 * This used to count `unreadCount` qualifying messages backwards from the end
 * of the list instead, which meant re-deriving the server's answer from the
 * client's window and getting it wrong whenever the two disagreed by even one
 * message — a message arriving between the two fetches, a duplicate from a
 * drifted page, an own or system message miscounted. Comparing ids removes
 * the arithmetic: the anchor travels with the data.
 *
 * `unreadCount` is still needed, but only to label the divider and to know
 * whether to draw one at all.
 */
export function resolveUnreadBoundary(
  messages: MessageType[],
  lastReadMessageId: string | null | undefined,
  unreadCount: number,
  viewerId: string | undefined,
  hasMore: boolean,
): UnreadBoundaryResolution {
  if (unreadCount <= 0) {
    return { boundaryId: null, needsMore: false }
  }

  if (messages.length === 0) {
    return hasMore ? { boundaryId: undefined, needsMore: true } : { boundaryId: null, needsMore: false }
  }

  // Never read at all, so everything is unread and the divider belongs above
  // the very first message of the conversation. Paging an entire history back
  // just to draw a line above all of it is not worth the round trips, so this
  // waits until the whole conversation happens to be loaded and otherwise
  // draws nothing — the conversation list's unread badge still says so.
  if (lastReadMessageId === null || lastReadMessageId === undefined) {
    if (hasMore) {
      return { boundaryId: null, needsMore: false }
    }
    const first = messages.find((message) => countsAsUnread(message, viewerId))
    return { boundaryId: first?.id ?? null, needsMore: false }
  }

  const firstUnread = messages.find(
    (message) => message.id > lastReadMessageId && countsAsUnread(message, viewerId),
  )

  if (!firstUnread) {
    return { boundaryId: null, needsMore: false }
  }

  // The loaded window has to reach back far enough to be sure nothing older
  // is also unread: if its oldest message is itself newer than the anchor,
  // there may be earlier unread messages that simply have not loaded yet.
  // Unlike counting, this is precisely bounded — paging stops as soon as the
  // window covers the anchor, not after some number of messages.
  const reachesBackPastAnchor = messages[0].id <= lastReadMessageId
  if (reachesBackPastAnchor || !hasMore) {
    return { boundaryId: firstUnread.id, needsMore: false }
  }

  return { boundaryId: undefined, needsMore: true }
}
