import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import usePresenceHeartbeat from './usePresenceHeartbeat'
import { heartbeat, leaveViaBeacon } from '../services/api/presence'
import type { IdleState } from '../utils/baseTypes'

let idle: IdleState = 'active'

vi.mock('./useIdleState', () => ({ useIdleState: () => idle }))
vi.mock('../services/api/presence', () => ({
  heartbeat: vi.fn().mockResolvedValue(undefined),
  leave: vi.fn(),
  leaveViaBeacon: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers()
  idle = 'active'
  vi.mocked(heartbeat).mockClear()
  vi.mocked(leaveViaBeacon).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePresenceHeartbeat', () => {
  it('beats at once and every fifteen seconds, saying whether the app is in use', () => {
    renderHook(() => usePresenceHeartbeat(true))
    expect(heartbeat).toHaveBeenCalledTimes(1)
    expect(heartbeat).toHaveBeenLastCalledWith('active')

    vi.advanceTimersByTime(15_000)
    expect(heartbeat).toHaveBeenCalledTimes(2)
  })

  it('says so at once when the app goes idle, and again when it’s back, without leaving in between', () => {
    const { rerender } = renderHook(() => usePresenceHeartbeat(true))

    idle = 'away'
    rerender()
    expect(heartbeat).toHaveBeenCalledTimes(2)
    expect(heartbeat).toHaveBeenLastCalledWith('away')

    // The beats carry on saying away.
    vi.advanceTimersByTime(15_000)
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
})
