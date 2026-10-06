/** Where signing in leads when nothing sent the viewer there. */
const CHAT_LIST = '/conversations'

const KEY = 'rtm.returnPath'

/** Only a path in this app is ever followed — never another site, not even
 * one written as `//host` or `/\host`, which a browser reads as one. */
const isInAppPath = (path: string) => path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')

/**
 * Where to go once signed in: back to the page that sent the viewer here
 * (RequireAuth passes it along in the router's state, which no link can
 * set), or the chat list.
 */
export function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  return typeof from === 'string' && isInAppPath(from) ? from : CHAT_LIST
}

/**
 * Signing in with Google leaves the app, and the server always brings the
 * viewer back to the chat list, so the router's state doesn't survive the
 * trip. Where they were going is put aside for this tab first, and taken up
 * when they're back (see RequireAuth).
 */
export function setReturnPathAside(path: string): void {
  if (path === CHAT_LIST) return
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // Storage blocked: they land on the chat list, as they would have anyway.
  }
}

/** The path put aside before signing in, once: reading it removes it. */
export function takeReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return path !== null && isInAppPath(path) ? path : null
  } catch {
    return null
  }
}
