import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AWAY_AFTER_MS, LAST_ACTIVE_KEY, useIdleState } from './useIdleState'

const touch = (type = 'pointerdown') => act(() => void window.dispatchEvent(new Event(type)))

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

/** Another tab of the app being used, as this one hears of it. */
const otherTabUsed = () =>
  act(() => {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    window.dispatchEvent(new StorageEvent('storage', { key: LAST_ACTIVE_KEY }))
  })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useIdleState', () => {
  it('is active while the app is used, and away after five untouched minutes', () => {
    const { result } = renderHook(() => useIdleState())
    expect(result.current).toBe('active')

    wait(AWAY_AFTER_MS - 1)
    expect(result.current).toBe('active')

    wait(1)
    expect(result.current).toBe('away')
  })

  it('is back at the first touch', () => {
    const { result } = renderHook(() => useIdleState())
    wait(AWAY_AFTER_MS)
    expect(result.current).toBe('away')

    touch('keydown')
    expect(result.current).toBe('active')

    // And away again after another quiet spell.
    wait(AWAY_AFTER_MS)
    expect(result.current).toBe('away')
  })

  it('counts from the last touch, not the first', () => {
    const { result } = renderHook(() => useIdleState())

    // Touched half a minute in: five minutes after opening, it's been idle
    // for four and a half.
    wait(30_000)
    touch('pointermove')
    wait(AWAY_AFTER_MS - 30_000)
    expect(result.current).toBe('active')

    wait(30_000)
    expect(result.current).toBe('away')

    touch()
    wait(4 * 60_000)
    touch('pointermove')
    wait(4 * 60_000)
    expect(result.current).toBe('active')

    wait(60_000)
    expect(result.current).toBe('away')
  })

  it('counts the tab coming back into view as a touch', () => {
    const { result } = renderHook(() => useIdleState())
    wait(AWAY_AFTER_MS)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => void document.dispatchEvent(new Event('visibilitychange')))

    expect(result.current).toBe('active')
  })

  it('is kept active, and brought back, by the app being used in another tab', () => {
    const { result } = renderHook(() => useIdleState())

    // Used elsewhere just before this tab would have gone idle.
    wait(AWAY_AFTER_MS - 1000)
    act(() => void localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())))
    wait(1000)
    expect(result.current).toBe('active')

    wait(AWAY_AFTER_MS)
    expect(result.current).toBe('away')

    otherTabUsed()
    expect(result.current).toBe('active')
  })

  it('shares when it was last touched, without writing on every move', () => {
    renderHook(() => useIdleState())
    const opened = Number(localStorage.getItem(LAST_ACTIVE_KEY))
    expect(opened).toBe(Date.now())

    wait(1000)
    touch('pointermove')
    expect(Number(localStorage.getItem(LAST_ACTIVE_KEY))).toBe(opened)

    wait(15_000)
    touch('pointermove')
    expect(Number(localStorage.getItem(LAST_ACTIVE_KEY))).toBe(Date.now())
  })

  it('still goes away and comes back with storage blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useIdleState())

    wait(AWAY_AFTER_MS)
    expect(result.current).toBe('away')

    touch()
    expect(result.current).toBe('active')
  })

  it('stops listening, and timing, once the app closes', () => {
    const removed = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useIdleState())
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'storage']) {
      expect(removed).toHaveBeenCalledWith(type, expect.any(Function))
    }
  })
})
