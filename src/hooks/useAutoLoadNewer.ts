import { useEffect, type RefObject } from 'react'

const NEAR_BOTTOM_PX = 120

interface Options {
  containerRef: RefObject<HTMLElement | null>
  /** The list stops short of the newest message (see useMessages's hasNewer). */
  hasNewer: boolean
  isLoadingNewer: boolean
  /** A whole-query refetch is in flight — see useAutoLoadOlder's note. */
  isRefreshing?: boolean
  onLoadNewer: () => void
}

/**
 * The other half of useAutoLoadOlder, for a window opened around a jump:
 * reads the next newer page as the viewer scrolls near the bottom, until
 * the window has caught up with the newest message. Nothing to restore
 * afterwards — a page added below the view doesn't move it.
 *
 * Not before the list has been placed at the message it opened on (the
 * `data-positioned` attribute useStickToBottom sets): until then it sits at
 * the top, and a list too short to scroll reads as one that needs more.
 */
export function useAutoLoadNewer({
  containerRef,
  hasNewer,
  isLoadingNewer,
  isRefreshing = false,
  onLoadNewer,
}: Options) {
  useEffect(() => {
    const container = containerRef.current
    if (!container || !hasNewer || isLoadingNewer || isRefreshing) return

    const maybeLoadNewer = () => {
      if (container.dataset.positioned === undefined) return
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight
      const notYetScrollable = container.scrollHeight <= container.clientHeight
      if (distance < NEAR_BOTTOM_PX || notYetScrollable) {
        onLoadNewer()
      }
    }

    maybeLoadNewer()
    container.addEventListener('scroll', maybeLoadNewer, { passive: true })
    return () => container.removeEventListener('scroll', maybeLoadNewer)
  }, [containerRef, hasNewer, isLoadingNewer, isRefreshing, onLoadNewer])
}
