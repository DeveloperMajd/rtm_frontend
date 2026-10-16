import { useEffect, useRef, useState } from 'react'
import * as presenceApi from '../services/api/presence'
import { useIdleState } from './useIdleState'

const HEARTBEAT_INTERVAL_MS = 15000

/** How long a tab can stay out of view before it stops beating. It has been
 * away for five of those minutes already (useIdleState), so this is the step
 * from away to offline, and a tab forgotten in the background stops calling
 * the server, which lets the database go to sleep. */
export const STOP_AFTER_HIDDEN_MS = 10 * 60_000

/** Whether the page has been out of view (another tab in front, the window
 * minimised) for `ms` on end; false again the moment it's back in view. */
function useHiddenFor(ms: number): boolean {
  const [hiddenFor, setHiddenFor] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const onVisibility = () => {
      clearTimeout(timer)
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(() => setHiddenFor(true), ms)
      } else {
        setHiddenFor(false)
      }
    }

    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [ms])

  return hiddenFor
}

/**
 * Keeps the viewer online while the app is open, telling the server on each
 * beat whether they're using it or have left it idle (useIdleState). A
 * change is told at once rather than at the next beat, so coming back from
 * away shows within the others' next refresh; it's only another beat, never
 * a leave and a return, so nobody sees them go offline in between.
 *
 * A tab out of view for STOP_AFTER_HIDDEN_MS stops beating, and beats again
 * the moment it's back in view. It doesn't leave: its last beat runs out
 * within 30 seconds, so its user shows offline unless another of their tabs
 * is still beating, which leaving would cut short.
 */
const usePresenceHeartbeat = (enabled: boolean): void => {
  const state = useIdleState()
  const stateRef = useRef(state)
  const beatingRef = useRef(false)
  const hiddenTooLong = useHiddenFor(STOP_AFTER_HIDDEN_MS)
  const beating = enabled && !hiddenTooLong

  // Declared before the beat itself, so it runs first: a tab coming back
  // into view turns active in the same render its beat restarts in, and the
  // restart's first beat should already say so, and be the only one.
  useEffect(() => {
    if (stateRef.current === state) return
    stateRef.current = state
    if (beatingRef.current) void presenceApi.heartbeat(state)
  }, [state])

  useEffect(() => {
    if (!beating) return

    beatingRef.current = true
    void presenceApi.heartbeat(stateRef.current)
    const interval = setInterval(() => void presenceApi.heartbeat(stateRef.current), HEARTBEAT_INTERVAL_MS)

    return () => {
      beatingRef.current = false
      clearInterval(interval)
    }
  }, [beating])

  // Leaving is for the app closing (or no longer enabled), not for a tab
  // that has only stopped beating.
  useEffect(() => {
    if (!enabled) return

    const handlePageHide = () => presenceApi.leaveViaBeacon()
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      presenceApi.leaveViaBeacon()
    }
  }, [enabled])
}

export default usePresenceHeartbeat
