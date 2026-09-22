import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReadStateSnapshot } from './useReadStateSnapshot'

describe('useReadStateSnapshot', () => {
  it('stays undefined while this mount has not fetched conversations yet', () => {
    const { result } = renderHook(() => useReadStateSnapshot('c1', false, 5, 'm9'))
    expect(result.current).toBeUndefined()
  })

  it('captures the read state once conversations are ready', () => {
    const { result, rerender } = renderHook(
      ({ ready }) => useReadStateSnapshot('c1', ready, 5, 'm9'),
      { initialProps: { ready: false } },
    )
    expect(result.current).toBeUndefined()

    rerender({ ready: true })
    expect(result.current).toEqual({ unreadCount: 5, lastReadMessageId: 'm9' })
  })

  // Marking as read both zeroes the count and advances the anchor to the
  // newest message. If the snapshot followed either of those, the divider
  // would vanish or be pinned below every message and never be seen.
  it('keeps the original read state after mark-as-read moves both halves', () => {
    const { result, rerender } = renderHook(
      ({ count, anchor }) => useReadStateSnapshot('c1', true, count, anchor),
      { initialProps: { count: 3, anchor: 'm5' as string | null } },
    )
    expect(result.current).toEqual({ unreadCount: 3, lastReadMessageId: 'm5' })

    rerender({ count: 0, anchor: 'm8' })
    expect(result.current).toEqual({ unreadCount: 3, lastReadMessageId: 'm5' })
  })

  it('re-snapshots when the conversation id changes', () => {
    const { result, rerender } = renderHook(
      ({ id, count, anchor }) => useReadStateSnapshot(id, true, count, anchor),
      { initialProps: { id: 'c1', count: 3, anchor: 'm5' as string | null } },
    )
    expect(result.current).toEqual({ unreadCount: 3, lastReadMessageId: 'm5' })

    rerender({ id: 'c2', count: 7, anchor: 'x2' })
    expect(result.current).toEqual({ unreadCount: 7, lastReadMessageId: 'x2' })
  })

  // Without the id guard on the returned value, switching conversations
  // before the new one's read state has arrived hands the previous
  // conversation's snapshot to the new room, which would anchor a divider
  // there on a message id that does not even belong to it.
  it('does not leak the previous conversation snapshot while the next one is not ready', () => {
    const { result, rerender } = renderHook(
      ({ id, ready }) => useReadStateSnapshot(id, ready, 3, 'm5'),
      { initialProps: { id: 'c1', ready: true } },
    )
    expect(result.current).toEqual({ unreadCount: 3, lastReadMessageId: 'm5' })

    rerender({ id: 'c2', ready: false })
    expect(result.current).toBeUndefined()

    rerender({ id: 'c2', ready: true })
    expect(result.current).toEqual({ unreadCount: 3, lastReadMessageId: 'm5' })
  })

  it('treats a missing count and a missing anchor as zero and never-read', () => {
    const { result } = renderHook(() => useReadStateSnapshot('c1', true, undefined, undefined))
    expect(result.current).toEqual({ unreadCount: 0, lastReadMessageId: null })
  })
})
