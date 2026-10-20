const KEY = 'rtm.verificationLinkSentAt'

/**
 * When this tab last had a confirmation link sent for `userId`: at sign-up,
 * or by the "Check your email" screen. So the screen doesn't send another
 * every time it shows, and can resume the resend cooldown. Per tab, like the
 * return path; storage that's unavailable reads as "never sent".
 */
export function linkSentAt(userId: string): number | null {
  try {
    const [id, at] = (sessionStorage.getItem(KEY) ?? '').split('|')
    const time = Number(at)
    return id === userId && Number.isFinite(time) ? time : null
  } catch {
    return null
  }
}

export function rememberLinkSent(userId: string): void {
  try {
    sessionStorage.setItem(KEY, `${userId}|${Date.now()}`)
  } catch {
    // Storage blocked: at worst the screen sends one more link.
  }
}
