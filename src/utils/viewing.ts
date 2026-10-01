/**
 * Is the viewer looking at the app right now — the tab visible and the
 * window focused? What decides whether a message that arrives counts as
 * read (see useMessages).
 */
export function isViewing(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
}
