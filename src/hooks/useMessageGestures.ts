import { useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react'

/** How long a finger rests on a message before its actions open. */
export const LONG_PRESS_MS = 450
/** How far a resting finger may drift before it counts as a scroll or swipe. */
const MOVE_TOLERANCE = 10
/** How far right a message has to be pulled to start a reply. */
export const SWIPE_TRIGGER = 56
/** How far it follows the finger. */
const SWIPE_MAX = 72
/** Swipes starting this close to either screen edge are the system's (the
 * back gesture), not ours. */
const EDGE = 24
/** A long press or swipe ends with the finger lifting, which some browsers
 * turn into a click on whatever is under it by then — an image in the
 * message, or a button on the sheet that just opened. For this long after
 * the lift, that click is swallowed. */
const CLICK_GUARD_MS = 400

/**
 * Swallows the click (and, on Android, the browser's own long-press menu)
 * that the finger still on the screen will set off, until shortly after it
 * lifts. Listens on the document: once the sheet opens, the page under it
 * is inert, so the message itself may never hear the finger lift.
 */
function guardUntilLift() {
  const swallow = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const stop = () => {
    document.removeEventListener('click', swallow, true)
    document.removeEventListener('contextmenu', swallow, true)
  }
  const onLift = () => {
    document.removeEventListener('pointerup', onLift, true)
    document.removeEventListener('pointercancel', onLift, true)
    setTimeout(stop, CLICK_GUARD_MS)
  }
  document.addEventListener('click', swallow, true)
  document.addEventListener('contextmenu', swallow, true)
  document.addEventListener('pointerup', onLift, true)
  document.addEventListener('pointercancel', onLift, true)
}

type Gesture = {
  pointerId: number
  x: number
  y: number
  /** Still deciding; a swipe the message follows; a scroll the browser
   * handles; or finished (the long press fired). */
  mode: 'pending' | 'swipe' | 'scroll' | 'done'
  canSwipe: boolean
  offset: number
  timer?: ReturnType<typeof setTimeout>
}

interface Options {
  /** What follows the finger during a swipe. */
  targetRef: RefObject<HTMLElement | null>
  /** Omitted: no long press (a deleted message has no actions). */
  onLongPress?: () => void
  /** Omitted: no swipe (a read-only conversation can't be replied in). */
  onSwipe?: () => void
}

/**
 * A message's touch gestures (Mobile-430-Message-Sheet,
 * Mobile-430-Chat-Direct-Light): press and hold for its actions, or pull it
 * to the right to reply. Touch only — a mouse has the hover toolbar and a
 * keyboard has the toolbar's buttons, both of which stay as they are.
 *
 * Plain pointer events: a vertical drag is left to the browser to scroll
 * (the stylesheet sets `touch-action: pan-y` on the message), so only
 * sideways movement ever reaches the swipe.
 */
export default function useMessageGestures({ targetRef, onLongPress, onSwipe }: Options) {
  const gesture = useRef<Gesture | null>(null)
  const latest = useRef({ onLongPress, onSwipe })
  useEffect(() => {
    latest.current = { onLongPress, onSwipe }
  })

  useEffect(
    () => () => {
      clearTimeout(gesture.current?.timer)
    },
    [],
  )

  const follow = (offset: number) => {
    const target = targetRef.current
    if (!target) return
    // While the finger moves, the message tracks it exactly; let go, and the
    // stylesheet's transition carries it back.
    target.style.transition = offset ? 'none' : ''
    target.style.transform = offset ? `translateX(${offset}px)` : ''
    target.style.setProperty('--swipe', String(Math.min(offset / SWIPE_TRIGGER, 1)))
  }

  const finish = () => {
    clearTimeout(gesture.current?.timer)
    gesture.current = null
  }

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'touch' || !e.isPrimary) return
    const { onLongPress, onSwipe } = latest.current
    if (!onLongPress && !onSwipe) return

    const current: Gesture = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      mode: 'pending',
      canSwipe: Boolean(onSwipe) && e.clientX > EDGE && e.clientX < window.innerWidth - EDGE,
      offset: 0,
    }
    if (onLongPress) {
      current.timer = setTimeout(() => {
        if (gesture.current !== current || current.mode !== 'pending') return
        current.mode = 'done'
        guardUntilLift()
        navigator.vibrate?.(10)
        latest.current.onLongPress?.()
      }, LONG_PRESS_MS)
    }
    clearTimeout(gesture.current?.timer)
    gesture.current = current
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const current = gesture.current
    if (!current || e.pointerId !== current.pointerId) return
    const dx = e.clientX - current.x
    const dy = e.clientY - current.y

    if (current.mode === 'pending') {
      if (Math.abs(dx) < MOVE_TOLERANCE && Math.abs(dy) < MOVE_TOLERANCE) return
      clearTimeout(current.timer)
      current.mode = current.canSwipe && dx > 0 && Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll'
      // A swipe ends with a lift over the message — not a tap on it.
      if (current.mode === 'swipe') guardUntilLift()
    }

    if (current.mode === 'swipe') {
      current.offset = Math.max(0, Math.min(dx, SWIPE_MAX))
      follow(current.offset)
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const current = gesture.current
    if (!current || e.pointerId !== current.pointerId) return
    if (current.mode === 'swipe') {
      follow(0)
      if (current.offset >= SWIPE_TRIGGER) latest.current.onSwipe?.()
    }
    finish()
  }

  // The browser took over (it's scrolling) — put the message back.
  const onPointerCancel = (e: PointerEvent<HTMLElement>) => {
    const current = gesture.current
    if (!current || e.pointerId !== current.pointerId) return
    if (current.mode === 'swipe') follow(0)
    finish()
  }

  // A long press on Android opens the browser's own menu; the actions sheet
  // stands in for it.
  const onContextMenu = (e: MouseEvent<HTMLElement>) => {
    if (gesture.current) e.preventDefault()
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu }
}
