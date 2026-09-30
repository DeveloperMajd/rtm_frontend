import { useEffect, type RefObject } from 'react'
import { centredOffset, findMessageElement } from './useStickToBottom'

/**
 * A request to bring one message into view — from a reply's quote, a search
 * result or a link. `seq` tells two requests for the same message apart, so
 * following the same quote twice highlights it twice.
 */
export type JumpTarget = { id: string; seq: number }

/** DS-Signal-Motion "Jump highlight": 1.6 s, then the halo fades out. */
export const HIGHLIGHT_MS = 1600

interface Options {
  containerRef: RefObject<HTMLElement | null>
  jump: JumpTarget | null | undefined
  /** The target is among the rendered messages. */
  isTargetLoaded: boolean
}

/**
 * Lands a jump once its message is on screen: scrolls it to the middle of
 * the list, gives it the accent halo (Study-Reply "Jump to original"), and
 * moves focus to it, so a keyboard or screen-reader user arrives where
 * everyone else is looking rather than back on the quote they followed.
 *
 * The halo is a data attribute set here rather than state: it's a moment
 * of feedback on one element, and a re-render per jump for it would be
 * spent on nothing else. React doesn't own the attribute, so it can't be
 * wiped out by the row re-rendering in the meantime either.
 */
export function useJumpHighlight({ containerRef, jump, isTargetLoaded }: Options) {
  // Runs once per jump: a new request is a new object, and nothing else it
  // depends on changes once the target is on screen. (Replaying it — as
  // StrictMode does — just lands the same jump again.)
  useEffect(() => {
    const container = containerRef.current
    if (!jump || !container || !isTargetLoaded) return

    const row = findMessageElement(container, jump.id)
    if (!row) return

    // A short hop glides, so the eye can follow it. A long one goes straight
    // there: gliding through hundreds of messages takes longer than the
    // halo lasts, which would fade before its message came into view.
    const top = centredOffset(container, row)
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const isShortHop = Math.abs(top - container.scrollTop) < container.clientHeight * 2
    container.scrollTo?.({ top, behavior: isShortHop && !reduceMotion ? 'smooth' : 'auto' })

    // Focusable only from here on: a message isn't a tab stop of its own.
    row.setAttribute('tabindex', '-1')
    row.focus({ preventScroll: true })

    row.dataset.flash = ''
    const timer = setTimeout(() => delete row.dataset.flash, HIGHLIGHT_MS)
    return () => {
      clearTimeout(timer)
      delete row.dataset.flash
    }
  }, [containerRef, jump, isTargetLoaded])
}
