// Unsent composer text, kept in this browser per user and conversation, so
// it survives switching chats, a reload, or a session that expires
// mid-sentence (Auth-Session-Expired: "your unsent draft … is kept on this
// device"). Scoped by user id so someone else signing in on the same device
// never gets it back. Storage can be unavailable (private mode, blocked site
// data) — every access is guarded, and without it drafts simply aren't kept.

const PREFIX = 'rtm.draft.'

const keyFor = (userId: string, conversationId: string) => `${PREFIX}${userId}.${conversationId}`

export function loadDraft(userId: string, conversationId: string): string {
  try {
    return localStorage.getItem(keyFor(userId, conversationId)) ?? ''
  } catch {
    return ''
  }
}

/** Saves the text, or forgets the draft once there's nothing left in it. */
export function saveDraft(userId: string, conversationId: string, text: string): void {
  try {
    if (text.trim()) {
      localStorage.setItem(keyFor(userId, conversationId), text)
    } else {
      localStorage.removeItem(keyFor(userId, conversationId))
    }
  } catch {
    /* ignore */
  }
}

/** Forgets every draft this user left on the device — on a deliberate sign
 * out, so nothing they typed stays behind for the next person. */
export function clearDrafts(userId: string): void {
  try {
    const own = `${PREFIX}${userId}.`
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(own)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    /* ignore */
  }
}
