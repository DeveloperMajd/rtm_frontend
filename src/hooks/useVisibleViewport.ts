import { useEffect } from 'react'

/**
 * Keeps the signed-in app inside the part of the screen the on-screen
 * keyboard leaves, so a phone's composer sits right above the keyboard with
 * the conversation header still in view.
 *
 * Chrome and Firefox on Android shrink the page for the keyboard themselves
 * (the viewport meta's `interactive-widget=resizes-content`); Safari on iOS
 * doesn't — it lays the keyboard over the page and slides the whole page
 * up to show the field. The visual viewport says what's actually visible,
 * so this passes its height and offset to CSS as `--app-height` and
 * `--app-top` (see the `visible-viewport` mixin).
 *
 * Only while the page isn't pinch-zoomed: zoomed in, the visible area is a
 * magnified part of the page, and following it would undo the zoom.
 *
 * Nothing here chooses a layout — the breakpoints stay in CSS. It reacts to
 * the browser's resize and scroll events; it never polls.
 */
export default function useVisibleViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement

    const clear = () => {
      root.style.removeProperty('--app-height')
      root.style.removeProperty('--app-top')
    }

    const update = () => {
      if (Math.abs(viewport.scale - 1) > 0.01) {
        clear()
        return
      }
      root.style.setProperty('--app-height', `${Math.round(viewport.height)}px`)
      root.style.setProperty('--app-top', `${Math.round(viewport.offsetTop)}px`)
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      clear()
    }
  }, [])
}
