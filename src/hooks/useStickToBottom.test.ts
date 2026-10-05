import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useStickToBottom } from './useStickToBottom'

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

// `unreadBoundaryId: null` means "resolved — nothing unread", so these
// tests (which aren't exercising the unread-divider behavior) proceed
// immediately instead of waiting on a boundary that's never provided.
describe('useStickToBottom', () => {
  it('scrolls to the bottom on the first message it sees (initial load, no unread boundary)', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })

    renderHook(() =>
      useStickToBottom({
        containerRef: { current: container },
        lastMessageId: 'm1',
        isOwnLastMessage: false,
        unreadBoundaryId: null,
      }),
    )

    expect(container.scrollTop).toBe(2000)
  })

  it('waits for the unread boundary to resolve before making its first scroll decision', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })

    const { rerender } = renderHook(
      ({ unreadBoundaryId }: { unreadBoundaryId: string | null | undefined }) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId: 'm1',
          isOwnLastMessage: false,
          unreadBoundaryId,
        }),
      { initialProps: { unreadBoundaryId: undefined as string | null | undefined } },
    )
    // Still unresolved — must not have jumped to the bottom yet.
    expect(container.scrollTop).toBe(0)

    rerender({ unreadBoundaryId: null })
    expect(container.scrollTop).toBe(2000)
  })

  it('marks the list positioned only once it has scrolled there — the stylesheet keeps it hidden until then', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })

    const { rerender } = renderHook(
      ({ unreadBoundaryId }: { unreadBoundaryId: string | null | undefined }) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId: 'm1',
          isOwnLastMessage: false,
          unreadBoundaryId,
        }),
      { initialProps: { unreadBoundaryId: undefined as string | null | undefined } },
    )
    expect(container.dataset.positioned).toBeUndefined()

    rerender({ unreadBoundaryId: null })
    expect(container.dataset.positioned).toBe('')
  })

  it('shows the list at the bottom anyway if placing it takes too long', () => {
    vi.useFakeTimers()
    try {
      const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })
      renderHook(() =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId: 'm1',
          isOwnLastMessage: false,
          unreadBoundaryId: undefined,
        }),
      )

      act(() => {
        vi.advanceTimersByTime(2600)
      })

      expect(container.dataset.positioned).toBe('')
      expect(container.scrollTop).toBe(2000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('scrolls to the unread divider instead of the bottom when one is resolved', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })
    const divider = document.createElement('li')
    Object.defineProperty(divider, 'offsetTop', { value: 500, configurable: true })

    renderHook(() =>
      useStickToBottom({
        containerRef: { current: container },
        lastMessageId: 'm1',
        isOwnLastMessage: false,
        unreadBoundaryId: 'm1',
        unreadDividerRef: { current: divider },
      }),
    )

    expect(container.scrollTop).toBe(500 - 12)
  })

  it('auto-scrolls for a new message while already near the bottom', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600, scrollTop: 400 })

    const { result, rerender } = renderHook(
      ({ lastMessageId }: { lastMessageId: string }) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId,
          isOwnLastMessage: false,
          unreadBoundaryId: null,
        }),
      { initialProps: { lastMessageId: 'm1' } },
    )
    expect(result.current.newCount).toBe(0)

    Object.defineProperty(container, 'scrollHeight', { value: 1200, configurable: true })
    rerender({ lastMessageId: 'm2' })

    expect(container.scrollTop).toBe(1200)
    expect(result.current.newCount).toBe(0)
  })

  it('does not auto-scroll for someone else\'s message while scrolled away, and counts it instead', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600, scrollTop: 0 })

    const { result, rerender } = renderHook(
      ({ lastMessageId }: { lastMessageId: string }) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId,
          isOwnLastMessage: false,
          unreadBoundaryId: null,
        }),
      { initialProps: { lastMessageId: 'm1' } },
    )
    // The initial-load scroll already ran; simulate the viewer scrolling
    // back up before the next message arrives (dispatching the event too,
    // since the hook's own near-bottom state only updates on 'scroll').
    container.scrollTop = 0
    container.dispatchEvent(new Event('scroll'))

    Object.defineProperty(container, 'scrollHeight', { value: 1200, configurable: true })
    rerender({ lastMessageId: 'm2' })

    expect(container.scrollTop).toBe(0)
    expect(result.current.newCount).toBe(1)
  })

  it('always scrolls for the viewer\'s own message, even while scrolled away', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600, scrollTop: 0 })

    const { rerender } = renderHook(
      ({ lastMessageId, isOwn }: { lastMessageId: string; isOwn: boolean }) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId,
          isOwnLastMessage: isOwn,
          unreadBoundaryId: null,
        }),
      { initialProps: { lastMessageId: 'm1', isOwn: false } },
    )
    container.scrollTop = 0
    container.dispatchEvent(new Event('scroll'))

    Object.defineProperty(container, 'scrollHeight', { value: 1200, configurable: true })
    rerender({ lastMessageId: 'm2', isOwn: true })

    expect(container.scrollTop).toBe(1200)
  })

  it('scrollToBottom jumps down and resets the new-message count', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600, scrollTop: 0 })

    const { result, rerender } = renderHook(
      ({ lastMessageId }: { lastMessageId: string }) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId,
          isOwnLastMessage: false,
          unreadBoundaryId: null,
        }),
      { initialProps: { lastMessageId: 'm1' } },
    )
    container.scrollTop = 0
    container.dispatchEvent(new Event('scroll'))
    Object.defineProperty(container, 'scrollHeight', { value: 1200, configurable: true })
    rerender({ lastMessageId: 'm2' })
    expect(result.current.newCount).toBe(1)

    act(() => {
      result.current.scrollToBottom()
    })

    expect(container.scrollTop).toBe(1200)
    expect(result.current.newCount).toBe(0)
  })

  // Reported: a "1 new message" pill hanging around over a message the
  // viewer had already scrolled down to. The count only ever reset when the
  // pill itself was clicked, so scrolling down by hand left it stranded.
  it('clears the new-message count once the viewer scrolls back down to the newest message', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600, scrollTop: 0 })

    const { result, rerender } = renderHook(
      ({ lastMessageId }: { lastMessageId: string }) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId,
          isOwnLastMessage: false,
          unreadBoundaryId: null,
        }),
      { initialProps: { lastMessageId: 'm1' } },
    )

    // Reading older history, then a message arrives.
    container.scrollTop = 0
    container.dispatchEvent(new Event('scroll'))
    Object.defineProperty(container, 'scrollHeight', { value: 1200, configurable: true })
    rerender({ lastMessageId: 'm2' })
    expect(result.current.newCount).toBe(1)

    // The viewer scrolls down to the bottom themselves, without the pill.
    act(() => {
      container.scrollTop = 600
      container.dispatchEvent(new Event('scroll'))
    })

    expect(result.current.newCount).toBe(0)
  })

  it('keeps the count while the viewer is still reading well above the bottom', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600, scrollTop: 0 })

    const { result, rerender } = renderHook(
      ({ lastMessageId }: { lastMessageId: string }) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId,
          isOwnLastMessage: false,
          unreadBoundaryId: null,
        }),
      { initialProps: { lastMessageId: 'm1' } },
    )

    container.scrollTop = 0
    container.dispatchEvent(new Event('scroll'))
    Object.defineProperty(container, 'scrollHeight', { value: 1200, configurable: true })
    rerender({ lastMessageId: 'm2' })
    expect(result.current.newCount).toBe(1)

    // Scrolling a little, but still far from the newest message.
    act(() => {
      container.scrollTop = 100
      container.dispatchEvent(new Event('scroll'))
    })

    expect(result.current.newCount).toBe(1)
  })
})

// Reported while building Stage 5: opening a reply banner grew the composer,
// shrank the message list, and pushed the newest message out of view — a
// shrinking scroller keeps its scrollTop, and no scroll event fires.
describe('useStickToBottom — the list getting shorter', () => {
  let resize: () => void = () => {}

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const shrink = (container: HTMLElement, to: number) => {
    Object.defineProperty(container, 'clientHeight', { value: to, configurable: true })
    resize()
  }

  it('keeps the newest message in view when the viewer was at the bottom', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })
    renderHook(() =>
      useStickToBottom({
        containerRef: { current: container },
        lastMessageId: 'm1',
        isOwnLastMessage: false,
        unreadBoundaryId: null,
      }),
    )
    expect(container.scrollTop).toBe(2000) // initial load pinned it to the bottom
    container.scrollTop = 1400 // what the browser clamps that to at 600px tall

    shrink(container, 520)

    expect(container.scrollTop).toBe(2000)
  })

  it('leaves the position alone when the viewer was reading older history', () => {
    const container = makeContainer({ scrollHeight: 2000, clientHeight: 600, scrollTop: 0 })
    renderHook(() =>
      useStickToBottom({
        containerRef: { current: container },
        lastMessageId: 'm1',
        isOwnLastMessage: false,
        unreadBoundaryId: null,
      }),
    )
    container.scrollTop = 300

    shrink(container, 520)

    expect(container.scrollTop).toBe(300)
  })
})

describe('useStickToBottom — a window opened around a jump', () => {
  type Props = { lastMessageId: string | undefined; detached: boolean }

  const renderJumpWindow = (container: HTMLElement, initialProps: Props) =>
    renderHook(
      ({ lastMessageId, detached }: Props) =>
        useStickToBottom({
          containerRef: { current: container },
          lastMessageId,
          isOwnLastMessage: false,
          unreadBoundaryId: null,
          openAtId: 'm5',
          detached,
        }),
      { initialProps },
    )

  it('opens with the message it was opened for in the middle of the view', () => {
    const container = makeContainer({ scrollHeight: 3000, clientHeight: 600 })
    const row = document.createElement('li')
    row.dataset.messageId = 'm5'
    Object.defineProperty(row, 'offsetHeight', { value: 40 })
    row.getBoundingClientRect = () => ({ top: 900 }) as DOMRect
    container.appendChild(row)

    renderJumpWindow(container, { lastMessageId: 'm9', detached: true })

    // 900 down the list, less half of what's left of the view around it.
    expect(container.scrollTop).toBe(900 - (600 - 40) / 2)
    expect(container.dataset.positioned).toBe('')
  })

  it('doesn’t wait for an unread divider it will never have', () => {
    const container = makeContainer({ scrollHeight: 3000, clientHeight: 600 })

    renderHook(() =>
      useStickToBottom({
        containerRef: { current: container },
        lastMessageId: 'm9',
        isOwnLastMessage: false,
        unreadBoundaryId: undefined,
        openAtId: 'm5',
      }),
    )

    expect(container.dataset.positioned).toBe('')
  })

  // Reading forwards is what the viewer scrolled down to do: sending them
  // to the bottom of what just loaded would skip all of it.
  it('leaves the view alone while newer history loads in below, and counts none of it as new', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600 })
    const { result, rerender } = renderJumpWindow(container, { lastMessageId: 'm6', detached: true })
    container.scrollTop = 380 // near the bottom, which is what asked for more
    container.dispatchEvent(new Event('scroll'))

    Object.defineProperty(container, 'scrollHeight', { value: 2000, configurable: true })
    rerender({ lastMessageId: 'm8', detached: true })
    expect(container.scrollTop).toBe(380)

    // The last page — the one that reaches the newest message — too.
    Object.defineProperty(container, 'scrollHeight', { value: 3000, configurable: true })
    rerender({ lastMessageId: 'm9', detached: false })
    expect(container.scrollTop).toBe(380)
    expect(result.current.newCount).toBe(0)
  })

  it('treats messages after it has caught up as arrivals, counted while the viewer reads above them', () => {
    const container = makeContainer({ scrollHeight: 1000, clientHeight: 600 })
    const { result, rerender } = renderJumpWindow(container, { lastMessageId: 'm6', detached: true })
    container.scrollTop = 380
    container.dispatchEvent(new Event('scroll'))

    Object.defineProperty(container, 'scrollHeight', { value: 3000, configurable: true })
    rerender({ lastMessageId: 'm9', detached: false })

    rerender({ lastMessageId: 'm10', detached: false })
    expect(container.scrollTop).toBe(380)
    expect(result.current.newCount).toBe(1)
  })
})
