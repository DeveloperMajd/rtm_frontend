import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

const NEAR_BOTTOM_PX = 120
/** How long the list may stay hidden waiting to learn where to open, before
 * it's shown at the bottom anyway (see the positioning note below). */
const POSITION_TIMEOUT_MS = 2500

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
  /**
   * Open centred on this message rather than at the bottom or the unread
   * divider — a window opened around a jump. Found by its `data-message-id`.
   */
  openAtId?: string
  /**
   * The list stops short of the newest message (a jump's window that hasn't
   * caught up). What changes at its end then is a page of newer history
   * being read in, not a message arriving: it's neither counted nor
   * followed down.
   */
  detached?: boolean
}

/** The rendered row of one message, found by its `data-message-id`. */
export function findMessageElement(container: HTMLElement, messageId: string): HTMLElement | null {
  for (const element of container.querySelectorAll<HTMLElement>('[data-message-id]')) {
    if (element.dataset.messageId === messageId) return element
  }
  return null
}

/** Scroll offset that puts `element` in the middle of `container`. */
export function centredOffset(container: HTMLElement, element: HTMLElement): number {
  const top = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
  return Math.max(top - (container.clientHeight - element.offsetHeight) / 2, 0)
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
  openAtId,
  detached = false,
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

  // Stay at the bottom when the list itself gets shorter — the composer
  // growing a reply/edit banner, say. Shrinking a scroller keeps its
  // scrollTop, which quietly pushes the newest messages out of view below
  // the fold without any scroll event to react to. Whether the viewer was
  // at the bottom is worked out against the height from *before* the
  // resize, since that's the view they were actually looking at.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    let lastHeight = container.clientHeight
    const observer = new ResizeObserver(() => {
      const height = container.clientHeight
      const wasNearBottom =
        container.scrollHeight - container.scrollTop - lastHeight < NEAR_BOTTOM_PX
      if (height < lastHeight && wasNearBottom) {
        container.scrollTop = container.scrollHeight
      }
      lastHeight = height
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef])

  // Whether the list stopped short of the newest message as of the last
  // change to its end — the render before a page of newer history lands is
  // the one that knows it was a page, since landing the last one can also
  // make the list reach the end.
  const [wasDetached, setWasDetached] = useState(detached)
  if (lastMessageId !== undefined && lastMessageId !== countedForId) {
    const isVeryFirst = countedForId === undefined
    setCountedForId(lastMessageId)
    if (wasDetached && !isVeryFirst) {
      // A page read in below the view: whoever was near the bottom isn't
      // any more, and nothing about it is new.
      setIsNearBottom(false)
    } else {
      setNewCount(isVeryFirst || isNearBottom || isOwnLastMessage ? 0 : (n) => n + 1)
    }
  }
  if (wasDetached !== detached) {
    setWasDetached(detached)
  }

  // --- The actual scroll mutation — a real side effect, kept free of any
  // setState calls (a ref tracks what it's already handled instead). ---
  //
  // Until the first position is set, the messages are rendered but kept out
  // of sight (`data-positioned` is missing; the stylesheet hides the list and
  // shows the loading skeleton over it). The first position waits for the
  // unread divider to be placed, and a list shown before then sat at the top
  // — the oldest loaded messages — and then jumped. It's an attribute set
  // here rather than state: this runs before paint, so the list appears
  // already in place.
  const scrolledForIdRef = useRef<string | undefined>(undefined)
  const isFirstScrollRef = useRef(true)
  const wasDetachedRef = useRef(detached)
  useLayoutEffect(() => {
    // Read and move on before anything returns early: a later run has to
    // know how this one left the list, whichever branch it took.
    const pageLanded = wasDetachedRef.current
    wasDetachedRef.current = detached

    if (lastMessageId === undefined || lastMessageId === scrolledForIdRef.current) return

    const wasFirst = isFirstScrollRef.current
    // Wait for the boundary to resolve — unless opening at a message, where
    // there's no divider to find.
    if (wasFirst && unreadBoundaryId === undefined && !openAtId) return

    scrolledForIdRef.current = lastMessageId
    const container = containerRef.current

    if (wasFirst) {
      isFirstScrollRef.current = false
      if (container) {
        const opening = openAtId ? findMessageElement(container, openAtId) : null
        const divider = unreadBoundaryId ? unreadDividerRef?.current : null
        container.scrollTop = opening
          ? centredOffset(container, opening)
          : divider
            ? Math.max(divider.offsetTop - 12, 0)
            : container.scrollHeight
        container.dataset.positioned = ''
      }
      return
    }

    // Newer history read in below, where the viewer is heading anyway:
    // leave them where they are rather than send them past all of it.
    if (pageLanded) return

    if ((isNearBottom || isOwnLastMessage) && container) {
      container.scrollTop = container.scrollHeight
    }
  }, [lastMessageId, isNearBottom, isOwnLastMessage, unreadBoundaryId, unreadDividerRef, containerRef, openAtId, detached])

  // A safety net: if deciding where to open takes too long (a slow network
  // holding up the read state), show the list at the bottom rather than
  // keep it hidden. The divider still takes over once it's placed.
  const hasMessages = lastMessageId !== undefined
  useEffect(() => {
    const container = containerRef.current
    if (!hasMessages || !container) return
    const timeout = setTimeout(() => {
      if (container.dataset.positioned !== undefined) return
      container.scrollTop = container.scrollHeight
      container.dataset.positioned = ''
    }, POSITION_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [hasMessages, containerRef])

  const scrollToBottom = () => {
    const container = containerRef.current
    if (container) container.scrollTop = container.scrollHeight
    setNewCount(0)
  }

  return { newCount, scrollToBottom }
}
