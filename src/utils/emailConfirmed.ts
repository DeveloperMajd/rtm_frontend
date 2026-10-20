const CHANNEL = 'rtm.email-confirmed'

/**
 * Tells this browser's other RTM tabs that `userId` has just confirmed their
 * address (VerifyEmailPage), so one still showing "Check your email" carries
 * on by itself. Same site and browser only: a tab on another device picks it
 * up when it's next in view (VerifyEmailScreen re-checks then).
 */
export function announceEmailConfirmed(userId: string): void {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(CHANNEL)
  channel.postMessage(userId)
  channel.close()
}

/** Calls `listener` with the user id another tab announces; returns a stop. */
export function onEmailConfirmed(listener: (userId: string) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data === 'string') listener(event.data)
  }
  return () => channel.close()
}
