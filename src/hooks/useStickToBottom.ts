import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

const NEAR_BOTTOM_PX = 120

interface Options {
  containerRef: RefObject<HTMLElement | null>
  lastMessageId: string | undefined
  isOwnLastMessage: boolean
  /** The unread divider's resolved state (see useUnreadSnapshot /
   * findUnreadBoundaryId): undefined = not resolved yet, null = nothing
   * unread, a string = the id of the first unread message. The very first
   * scroll position waits for this rather than always landing at the
   * bottom — a conversation opened with unread history above the fold
   * should land there, not force the viewer down past it. */
  unreadBoundaryId?: string | null
  /** Where to scroll to when unreadBoundaryId names a real message —
   * typically a ref on the rendered divider row itself. */
  unreadDividerRef?: RefObject<HTMLElement | null>
}

/**
 * Keeps the message list scrolled to the newest message as long as the
 * viewer is already near the bottom (or the arriving message is their own
 * — people expect to see what they just sent) — otherwise leaves the
 * scroll position alone and counts the message, so a "N new messages"
 * pill can offer to jump down instead of yanking someone reading older
 * history back to the bottom underneath them.
 *
 * Two independent "have I already handled this message" trackers are used
 * on purpose, not one shared one: the scroll decision lives in a ref,
 * read/written only inside the layout effect (refs can't safely be
 * touched during render); the new-message count is state, adjusted
 * during render (React's documented pattern for that). Sharing a single
 * tracker between them doesn't work — marking a message "seen" for one
 * purpose during render would make the effect's own re-derivation of
 * "is this new" see it as already handled by the time it runs.
 *
 * Depends on `containerRef` pointing at an element that's mounted from
 * the caller's very first render onward (not conditionally swapped for
 * something else while loading) — the effect below only re-attaches its
 * scroll listener when the stable ref *object* changes, which a plain
 * `useRef` never does, so a ref that starts out null on a conditionally
 * absent element would never get a second chance to attach once a real
 * element appears.
 */
export function useStickToBottom({
  containerRef,
  lastMessageId,
  isOwnLastMessage,
  unreadBoundaryId,
  unreadDividerRef,
}: Options) {
  const [isNearBottom, setIsNearBottom] = useState(true)

  // --- New-message count, for the "N new messages" pill ---
  const [newCount, setNewCount] = useState(0)
  const [countedForId, setCountedForId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight
      const nearBottom = distance < NEAR_BOTTOM_PX
      setIsNearBottom(nearBottom)

      // Scrolling down to the newest message is as good as pressing the
      // pill: there is nothing left to jump to, so the offer goes away.
      // Without this the count only ever reset on a click, leaving a stale
      // "1 new message" sitting over a message the viewer was already
      // looking at. Safe to call from an event handler (unlike from an
      // effect), and a no-op re-render when the count is already 0.
      if (nearBottom) {
        setNewCount(0)
      }
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerRef])

  if (lastMessageId !== undefined && lastMessageId !== countedForId) {
    const isVeryFirst = countedForId === undefined
    setCountedForId(lastMessageId)
    setNewCount(isVeryFirst || isNearBottom || isOwnLastMessage ? 0 : (n) => n + 1)
  }

  // --- The actual scroll mutation — a real side effect, kept free of any
  // setState calls (a ref tracks what it's already handled instead). ---
  const scrolledForIdRef = useRef<string | undefined>(undefined)
  const isFirstScrollRef = useRef(true)
  useLayoutEffect(() => {
    if (lastMessageId === undefined || lastMessageId === scrolledForIdRef.current) return

    const wasFirst = isFirstScrollRef.current
    if (wasFirst && unreadBoundaryId === undefined) return // wait for the boundary to resolve

    scrolledForIdRef.current = lastMessageId
    const container = containerRef.current

    if (wasFirst) {
      isFirstScrollRef.current = false
      const target = unreadBoundaryId ? unreadDividerRef?.current : null
      if (container) {
        container.scrollTop = target ? Math.max(target.offsetTop - 12, 0) : container.scrollHeight
      }
      return
    }

    if ((isNearBottom || isOwnLastMessage) && container) {
      container.scrollTop = container.scrollHeight
    }
  }, [lastMessageId, isNearBottom, isOwnLastMessage, unreadBoundaryId, unreadDividerRef, containerRef])

  const scrollToBottom = () => {
    const container = containerRef.current
    if (container) container.scrollTop = container.scrollHeight
    setNewCount(0)
  }

  return { newCount, scrollToBottom }
}
