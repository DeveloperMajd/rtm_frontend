import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import usePresenceHeartbeat, { STOP_AFTER_HIDDEN_MS } from './usePresenceHeartbeat'
import { heartbeat, leaveViaBeacon } from '../services/api/presence'
import type { IdleState } from '../utils/baseTypes'

let idle: IdleState = 'active'
let visibility: DocumentVisibilityState = 'visible'
let visibilitySpy: MockInstance

vi.mock('./useIdleState', () => ({ useIdleState: () => idle }))
vi.mock('../services/api/presence', () => ({
  heartbeat: vi.fn().mockResolvedValue(undefined),
  leave: vi.fn(),
  leaveViaBeacon: vi.fn(),
}))

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

/** The tab going out of view (another tab in front) or back into it. */
const setVisibility = (next: DocumentVisibilityState) =>
  act(() => {
    visibility = next
    document.dispatchEvent(new Event('visibilitychange'))
  })

beforeEach(() => {
  vi.useFakeTimers()
  idle = 'active'
  visibility = 'visible'
  visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  vi.mocked(heartbeat).mockClear()
  vi.mocked(leaveViaBeacon).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  visibilitySpy.mockRestore()
})

describe('usePresenceHeartbeat', () => {
  it('beats at once and every thirty seconds, saying whether the app is in use', () => {
    renderHook(() => usePresenceHeartbeat(true))
    expect(heartbeat).toHaveBeenCalledTimes(1)
    expect(heartbeat).toHaveBeenLastCalledWith('active')

    vi.advanceTimersByTime(30_000)
    expect(heartbeat).toHaveBeenCalledTimes(2)
  })

  it('says so at once when the app goes idle, and again when it’s back, without leaving in between', () => {
    const { rerender } = renderHook(() => usePresenceHeartbeat(true))

    idle = 'away'
    rerender()
    expect(heartbeat).toHaveBeenCalledTimes(2)
    expect(heartbeat).toHaveBeenLastCalledWith('away')

    // The beats carry on saying away.
    vi.advanceTimersByTime(30_000)
    expect(heartbeat).toHaveBeenLastCalledWith('away')

    idle = 'active'
    rerender()
    expect(heartbeat).toHaveBeenLastCalledWith('active')
    expect(leaveViaBeacon).not.toHaveBeenCalled()
  })

  it('doesn’t beat again for a render that changes nothing', () => {
    const { rerender } = renderHook(() => usePresenceHeartbeat(true))
    rerender()
    rerender()

    expect(heartbeat).toHaveBeenCalledTimes(1)
  })

  it('leaves when the app closes, and stops beating', () => {
    const { unmount } = renderHook(() => usePresenceHeartbeat(true))
    unmount()

    expect(leaveViaBeacon).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(heartbeat).toHaveBeenCalledTimes(1)
  })

  it('does nothing while not enabled, not even for a change', () => {
    const { rerender } = renderHook(() => usePresenceHeartbeat(false))
    idle = 'away'
    rerender()
    vi.advanceTimersByTime(60_000)

    expect(heartbeat).not.toHaveBeenCalled()
  })

  it('stops beating once the tab has been out of view for ten minutes, without leaving', () => {
    renderHook(() => usePresenceHeartbeat(true))
    wait(5_000)
    setVisibility('hidden')

    // Still beating just before the ten minutes are up: the first beat and
    // one every thirty seconds since…
    wait(STOP_AFTER_HIDDEN_MS - 1)
    expect(heartbeat).toHaveBeenCalledTimes(21)

    // …and not at all after.
    wait(1)
    wait(30 * 60_000)
    expect(heartbeat).toHaveBeenCalledTimes(21)
    // The last beat runs out on its own: leaving would also take someone
    // offline whose other tab is still in use.
    expect(leaveViaBeacon).not.toHaveBeenCalled()
  })

  it('beats at once when the tab is back, saying it’s in use, and only once', () => {
    const { rerender } = renderHook(() => usePresenceHeartbeat(true))
    setVisibility('hidden')
    idle = 'away'
    rerender()
    wait(STOP_AFTER_HIDDEN_MS)
    vi.mocked(heartbeat).mockClear()

    // Coming back into view counts as a touch, so it's active again in the
    // same render the beat restarts in.
    idle = 'active'
    setVisibility('visible')
    expect(heartbeat).toHaveBeenCalledTimes(1)
    expect(heartbeat).toHaveBeenLastCalledWith('active')

    wait(30_000)
    expect(heartbeat).toHaveBeenCalledTimes(2)
  })

  it('starts the ten minutes over each time the tab is back in view', () => {
    renderHook(() => usePresenceHeartbeat(true))
    setVisibility('hidden')
    wait(STOP_AFTER_HIDDEN_MS - 60_000)
    setVisibility('visible')
    setVisibility('hidden')
    wait(STOP_AFTER_HIDDEN_MS - 60_000)

    // Out of view for eighteen minutes in all, but never ten on end.
    const beats = vi.mocked(heartbeat).mock.calls.length
    wait(30_000)
    expect(heartbeat).toHaveBeenCalledTimes(beats + 1)
  })

  it('counts the ten minutes from the start for a tab opened out of view', () => {
    visibility = 'hidden'
    renderHook(() => usePresenceHeartbeat(true))
    wait(STOP_AFTER_HIDDEN_MS)

    const beats = vi.mocked(heartbeat).mock.calls.length
    wait(60_000)
    expect(heartbeat).toHaveBeenCalledTimes(beats)
  })
})
