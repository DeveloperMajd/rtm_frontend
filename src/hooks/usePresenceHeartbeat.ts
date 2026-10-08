import { useEffect, useRef } from 'react'
import * as presenceApi from '../services/api/presence'
import { useIdleState } from './useIdleState'

const HEARTBEAT_INTERVAL_MS = 15000

/**
 * Keeps the viewer online while the app is open, telling the server on each
 * beat whether they're using it or have left it idle (useIdleState). A
 * change is told at once rather than at the next beat, so coming back from
 * away shows within the others' next refresh; it's only another beat, never
 * a leave and a return, so nobody sees them go offline in between.
 */
const usePresenceHeartbeat = (enabled: boolean): void => {
  const state = useIdleState()
  const stateRef = useRef(state)

  useEffect(() => {
    if (!enabled) return

    void presenceApi.heartbeat(stateRef.current)
    const interval = setInterval(() => void presenceApi.heartbeat(stateRef.current), HEARTBEAT_INTERVAL_MS)

    const handlePageHide = () => presenceApi.leaveViaBeacon()
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      clearInterval(interval)
      window.removeEventListener('pagehide', handlePageHide)
      presenceApi.leaveViaBeacon()
    }
  }, [enabled])

  useEffect(() => {
    if (stateRef.current === state) return
    stateRef.current = state
    if (enabled) void presenceApi.heartbeat(state)
  }, [state, enabled])
}

export default usePresenceHeartbeat
