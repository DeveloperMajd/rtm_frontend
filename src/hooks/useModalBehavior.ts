import { useEffect, useRef, type RefObject } from 'react'

export const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

interface Options {
  open: boolean
  /** The dialog element — focus is kept inside it. */
  containerRef: RefObject<HTMLElement | null>
  onClose: () => void
  /** Where focus lands when it opens; the container's first focusable
   * element (or the container itself) when omitted. */
  getInitialFocus?: (container: HTMLElement) => HTMLElement | null
}

/**
 * What every modal surface needs while it's open (Modal, Lightbox): focus
 * moved inside and trapped there, Escape to close, focus handed back to
 * whatever had it before, the page behind marked `inert` and its scrolling
 * locked.
 */
export function useModalBehavior({ open, containerRef, onClose, getInitialFocus }: Options) {
  // The latest callbacks, so the effect below depends only on `open` — a
  // parent passing a new onClose each render must not re-run setup (which
  // would yank focus back to the first focusable).
  const latest = useRef({ onClose, getInitialFocus })
  useEffect(() => {
    latest.current = { onClose, getInitialFocus }
  })

  useEffect(() => {
    if (!open) return

    const restoreTo = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const container = containerRef.current
    if (container) {
      const initial =
        latest.current.getInitialFocus?.(container) ??
        container.querySelector<HTMLElement>(FOCUSABLE) ??
        container
      initial.focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        latest.current.onClose()
        return
      }
      if (e.key !== 'Tab' || !container) return

      const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      root?.removeAttribute('inert')
      document.body.style.overflow = prevOverflow
      restoreTo?.focus?.()
    }
  }, [open, containerRef])
}
