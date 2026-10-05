import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

export type PopoverAlign = 'start' | 'end'

export interface AnchorRect {
  top: number
  bottom: number
  left: number
  right: number
}

const GAP = 6
const VIEWPORT_MARGIN = 8

/**
 * Where to put a popover of `size` against `anchor`, in viewport
 * coordinates. Below the anchor by default; above it when it doesn't fit
 * below but there's more room above. Horizontally it lines up with the
 * anchor's start or end edge, then gets pulled back inside the viewport.
 */
export function placePopover(
  anchor: AnchorRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  align: PopoverAlign,
): { top: number; left: number; side: 'below' | 'above' } {
  const spaceBelow = viewport.height - anchor.bottom - GAP - VIEWPORT_MARGIN
  const spaceAbove = anchor.top - GAP - VIEWPORT_MARGIN
  const side = size.height <= spaceBelow || spaceBelow >= spaceAbove ? 'below' : 'above'

  const rawTop = side === 'below' ? anchor.bottom + GAP : anchor.top - GAP - size.height
  const rawLeft = align === 'start' ? anchor.left : anchor.right - size.width

  const clamp = (value: number, max: number) =>
    Math.min(Math.max(value, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, max - VIEWPORT_MARGIN))

  return {
    top: clamp(rawTop, viewport.height - size.height),
    left: clamp(rawLeft, viewport.width - size.width),
    side,
  }
}

interface Options {
  open: boolean
  popoverRef: RefObject<HTMLElement | null>
  /** Read when the popover opens and whenever the page scrolls or resizes. */
  getAnchorRect: () => AnchorRect | null
  align: PopoverAlign
  /** Pointer-downs on these don't count as "outside" — typically the
   * trigger, which toggles the popover itself. */
  ignoreRefs?: RefObject<HTMLElement | null>[]
  /** A pointer-down landed outside the popover. */
  onOutsidePointerDown: () => void
}

/**
 * Keeps a `position: fixed` popover (rendered in a portal, so a scrolling
 * message list can't clip it or grow to fit it) pinned to its anchor, and
 * reports clicks outside it.
 *
 * Position is written straight to the element's style rather than held in
 * state: it's measured from layout, so it can only be known after render,
 * and doing it in a layout effect places it before the first paint with no
 * visible jump. On scroll it follows the anchor instead of closing — the
 * message list scrolls on its own whenever a new message arrives, and a
 * menu that vanished every time that happened would be unusable.
 */
export function useAnchoredPopover({
  open,
  popoverRef,
  getAnchorRect,
  align,
  ignoreRefs = [],
  onOutsidePointerDown,
}: Options) {
  // The latest callbacks, read by long-lived listeners without making them
  // resubscribe every render (parents pass fresh closures each time).
  // A layout effect, declared before the one that positions the popover, so
  // it's already current when that runs: a plain effect would run after it,
  // and the first placement would use the previous render's anchor — which
  // is exactly what happens when one popover can open from two different
  // buttons.
  const latest = useRef({ getAnchorRect, onOutsidePointerDown, ignoreRefs, align })
  useLayoutEffect(() => {
    latest.current = { getAnchorRect, onOutsidePointerDown, ignoreRefs, align }
  })

  useLayoutEffect(() => {
    if (!open) return

    const position = () => {
      const popover = popoverRef.current
      const anchor = latest.current.getAnchorRect()
      if (!popover || !anchor) return
      const { top, left, side } = placePopover(
        anchor,
        { width: popover.offsetWidth, height: popover.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        latest.current.align,
      )
      popover.style.top = `${top}px`
      popover.style.left = `${left}px`
      popover.dataset.side = side
    }

    position()

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(position)
    }

    // Capture, so scrolling any ancestor of the anchor (the message list
    // itself) is seen, not only the window.
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [open, popoverRef])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (latest.current.ignoreRefs.some((ref) => ref.current?.contains(target))) return
      latest.current.onOutsidePointerDown()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, popoverRef])
}
