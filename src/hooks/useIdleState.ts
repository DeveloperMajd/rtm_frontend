import { useEffect, useState } from 'react'
import type { IdleState } from '../utils/baseTypes'

/** How long the app goes untouched, in all its tabs, before it says away. */
export const AWAY_AFTER_MS = 5 * 60_000

/** When the app was last touched, in any tab: shared, so the tabs agree. */
export const LAST_ACTIVE_KEY = 'rtm.lastActiveAt'

/** How often the shared time is written, at most: a moving pointer fires
 * dozens of events a second, and a few seconds either way don't matter
 * against minutes. */
const WRITE_EVERY_MS = 15_000

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

function readLastActive(): number {
  try {
    const at = Number(localStorage.getItem(LAST_ACTIVE_KEY))
    return Number.isFinite(at) ? at : 0
  } catch {
    return 0
  }
}

function writeLastActive(at: number): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(at))
  } catch {
    // Storage blocked: this tab goes by its own activity alone.
  }
}

/**
 * Away once the app has gone AWAY_AFTER_MS without a touch — a pointer,
 * a key, a scroll, or the tab coming back into view — in any of its tabs,
 * and active again at the next. Using one tab keeps the others active too:
 * the time of the last touch is shared through localStorage.
 *
 * Nothing polls. One timeout is set for the moment the app would go idle;
 * activity only notes the time, and when the timeout fires it either says
 * away or, if there's been activity since, sets itself for the new moment.
 */
export function useIdleState(): IdleState {
  const [state, setState] = useState<IdleState>('active')

  useEffect(() => {
    // Opening the app counts as using it.
    let lastActive = Date.now()
    let lastWritten = lastActive
    writeLastActive(lastActive)
    let isAway = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const arm = () => {
      clearTimeout(timer)
      // Another tab's touch counts as much as this one's.
      lastActive = Math.max(lastActive, readLastActive())
      const idleFor = Date.now() - lastActive
      if (idleFor >= AWAY_AFTER_MS) {
        isAway = true
        setState('away')
        return
      }
      timer = setTimeout(arm, AWAY_AFTER_MS - idleFor)
    }

    const becomeActive = () => {
      if (!isAway) return
      isAway = false
      setState('active')
      arm()
    }

    const onActivity = () => {
      const now = Date.now()
      lastActive = now
      if (now - lastWritten >= WRITE_EVERY_MS) {
        lastWritten = now
        writeLastActive(now)
      }
      becomeActive()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onActivity()
    }

    // Another tab was used: no longer away here either.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVE_KEY) return
      if (Date.now() - readLastActive() < AWAY_AFTER_MS) becomeActive()
    }

    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('storage', onStorage)
    arm()

    return () => {
      clearTimeout(timer)
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return state
}
