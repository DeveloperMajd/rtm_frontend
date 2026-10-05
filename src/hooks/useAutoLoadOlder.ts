import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const NEAR_TOP_PX = 120

interface Options {
  containerRef: RefObject<HTMLElement | null>
  hasMore: boolean
  isLoadingMore: boolean
  /**
   * A whole-query refetch is in flight. Paging must not start until it
   * settles: the two write to the same cached pages array and the loser of
   * that race silently discards the other's work (see useMessages's
   * isRefreshing).
   */
  isRefreshing?: boolean
  onLoadOlder: () => void
  /** The id of the oldest currently-loaded message — used to detect that a
   * page actually landed (as opposed to a new message arriving at the
   * bottom, which doesn't change this). */
  oldestMessageId: string | undefined
  /**
   * Keep loading more history regardless of scroll position — used when
   * the unread divider's target is known to exist but isn't in the
   * currently-loaded window yet (more unread messages than the first
   * page holds). Without this, opening a conversation with, say, 15
   * unread messages and a 10-message page size would give up and show no
   * divider at all rather than paging in enough history to find it.
   */
  forceLoad?: boolean
}

/**
 * Auto-loads older history as the user scrolls near the top of the message
 * list, replacing a manual "Load older" button — including an initial
 * check for a conversation whose first page doesn't fill the viewport at
 * all (so there's no scrollbar to scroll "near the top" of yet), and for
 * `forceLoad` (see above). Also restores the viewport's visual position
 * after older messages are prepended above it, instead of letting the
 * inserted content push whatever the viewer was reading further down the
 * screen.
 */
export function useAutoLoadOlder({
  containerRef,
  hasMore,
  isLoadingMore,
  isRefreshing = false,
  onLoadOlder,
  oldestMessageId,
  forceLoad = false,
}: Options) {
  const pendingRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)
  const lastOldestIdRef = useRef(oldestMessageId)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !hasMore || isLoadingMore || isRefreshing) return

    const maybeLoadOlder = () => {
      const nearTop = container.scrollTop < NEAR_TOP_PX
      const notYetScrollable = container.scrollHeight <= container.clientHeight
      if (nearTop || notYetScrollable || forceLoad) {
        pendingRestoreRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop }
        onLoadOlder()
      }
    }

    maybeLoadOlder()
    container.addEventListener('scroll', maybeLoadOlder, { passive: true })
    return () => container.removeEventListener('scroll', maybeLoadOlder)
  }, [containerRef, hasMore, isLoadingMore, isRefreshing, onLoadOlder, forceLoad])

  useLayoutEffect(() => {
    if (oldestMessageId === lastOldestIdRef.current) return
    lastOldestIdRef.current = oldestMessageId

    const pending = pendingRestoreRef.current
    const container = containerRef.current
    pendingRestoreRef.current = null
    if (!pending || !container) return

    const delta = container.scrollHeight - pending.scrollHeight
    container.scrollTop = pending.scrollTop + delta
  }, [oldestMessageId, containerRef])
}
