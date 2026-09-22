import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoLoadOlder } from './useAutoLoadOlder'

/** jsdom doesn't do layout, so scrollHeight/clientHeight are always 0 —
 * define them per-element so the "is this scrollable yet" logic has
 * something real to compare. */
function makeContainer({
  scrollHeight,
  clientHeight,
  scrollTop = 0,
}: {
  scrollHeight: number
  clientHeight: number
  scrollTop?: number
}) {
  const el = document.createElement('div')
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  el.scrollTop = scrollTop
  return el
}

describe('useAutoLoadOlder', () => {
  it('loads older messages immediately when the first page does not fill the viewport', () => {
    const container = makeContainer({ scrollHeight: 200, clientHeight: 600 })
    const onLoadOlder = vi.fn()

    renderHook(() =>
      useAutoLoadOlder({
        containerRef: { current: container },
        hasMore: true,
        isLoadingMore: false,
        onLoadOlder,
        oldestMessageId: 'm1',
      }),
    )

    expect(onLoadOlder).toHaveBeenCalledOnce()
  })

  // Regression test for the bug behind the "new messages never appeared"
  // and "divider anchored to a stale end of the list" reports. Refetching an
  // infinite query rebuilds its pages array page by page; a fetchNextPage
  // that starts mid-rebuild appends to the pre-refetch array, and whichever
  // request settles last wins. When the page fetch won it wrote back the old
  // pages — permanently discarding the freshly fetched first page along with
  // every message that had arrived while the room was closed. Auto-loading
  // fires on mount (the list isn't scrollable yet), which is exactly when
  // the mount refetch is in flight, so the two collided on nearly every open.
  it('does not page older while a whole-query refetch is in flight', () => {
    const container = makeContainer({ scrollHeight: 200, clientHeight: 600 })
    const onLoadOlder = vi.fn()

    const { rerender } = renderHook(
      ({ isRefreshing }) =>
        useAutoLoadOlder({
          containerRef: { current: container },
          hasMore: true,
          isLoadingMore: false,
          isRefreshing,
          onLoadOlder,
          oldestMessageId: 'm1',
        }),
      { initialProps: { isRefreshing: true } },
    )

    // Would otherwise fire immediately: the list does not fill the viewport.
    expect(onLoadOlder).not.toHaveBeenCalled()

    // Once the refetch settles, paging is free to resume.
    rerender({ isRefreshing: false })
    expect(onLoadOlder).toHaveBeenCalledOnce()
  })

  it('does not page older while refetching even when forceLoad is set', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 900 })
    const onLoadOlder = vi.fn()

    renderHook(() =>
      useAutoLoadOlder({
        containerRef: { current: container },
        hasMore: true,
        isLoadingMore: false,
        isRefreshing: true,
        forceLoad: true,
        onLoadOlder,
        oldestMessageId: 'm1',
      }),
    )

    expect(onLoadOlder).not.toHaveBeenCalled()
  })

  it('does not load when the list already fills the viewport and the viewer is not near the top', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 900 })
    const onLoadOlder = vi.fn()

    renderHook(() =>
      useAutoLoadOlder({
        containerRef: { current: container },
        hasMore: true,
        isLoadingMore: false,
        onLoadOlder,
        oldestMessageId: 'm1',
      }),
    )

    expect(onLoadOlder).not.toHaveBeenCalled()
  })

  it('loads more on scrolling near the top', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 900 })
    const onLoadOlder = vi.fn()

    renderHook(() =>
      useAutoLoadOlder({
        containerRef: { current: container },
        hasMore: true,
        isLoadingMore: false,
        onLoadOlder,
        oldestMessageId: 'm1',
      }),
    )
    expect(onLoadOlder).not.toHaveBeenCalled()

    container.scrollTop = 50
    container.dispatchEvent(new Event('scroll'))
    expect(onLoadOlder).toHaveBeenCalledOnce()
  })

  it('never calls onLoadOlder when hasMore is false', () => {
    const container = makeContainer({ scrollHeight: 200, clientHeight: 600 })
    const onLoadOlder = vi.fn()

    renderHook(() =>
      useAutoLoadOlder({
        containerRef: { current: container },
        hasMore: false,
        isLoadingMore: false,
        onLoadOlder,
        oldestMessageId: 'm1',
      }),
    )

    expect(onLoadOlder).not.toHaveBeenCalled()
  })

  it('restores the visual scroll position after older messages are prepended', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600, scrollTop: 50 })
    const onLoadOlder = vi.fn()

    const { rerender } = renderHook(
      ({ oldestMessageId }: { oldestMessageId: string }) =>
        useAutoLoadOlder({
          containerRef: { current: container },
          hasMore: true,
          isLoadingMore: false,
          onLoadOlder,
          oldestMessageId,
        }),
      { initialProps: { oldestMessageId: 'm10' } },
    )

    // A page of older messages landed: content grew by 400px above the
    // fold, and the oldest loaded message's id changed accordingly.
    Object.defineProperty(container, 'scrollHeight', { value: 1400, configurable: true })
    rerender({ oldestMessageId: 'm1' })

    // The viewer's 50px-from-top position should be preserved relative to
    // the content they were already looking at, not reset to the new top.
    expect(container.scrollTop).toBe(50 + 400)
  })

  it('loads more when forceLoad is set, even mid-viewport and not near the top', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 900 })
    const onLoadOlder = vi.fn()

    renderHook(() =>
      useAutoLoadOlder({
        containerRef: { current: container },
        hasMore: true,
        isLoadingMore: false,
        onLoadOlder,
        oldestMessageId: 'm1',
        forceLoad: true,
      }),
    )

    expect(onLoadOlder).toHaveBeenCalledOnce()
  })

  it('does not touch scroll position when a new message arrives at the bottom (oldest id unchanged)', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600, scrollTop: 50 })
    const onLoadOlder = vi.fn()

    const { rerender } = renderHook(
      ({ oldestMessageId }: { oldestMessageId: string }) =>
        useAutoLoadOlder({
          containerRef: { current: container },
          hasMore: true,
          isLoadingMore: false,
          onLoadOlder,
          oldestMessageId,
        }),
      { initialProps: { oldestMessageId: 'm1' } },
    )

    Object.defineProperty(container, 'scrollHeight', { value: 1100, configurable: true })
    rerender({ oldestMessageId: 'm1' })

    expect(container.scrollTop).toBe(50)
  })
})
