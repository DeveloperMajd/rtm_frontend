import { formatDistanceToNow } from 'date-fns'

/** "Online", "Last seen 3 hours ago", or "Offline" when there's no record —
 * the one-line presence under a person's name in lists and panels. */
export function presenceLabel(isOnline: boolean | undefined, lastSeenAt?: string | null): string {
  if (isOnline) return 'Online'
  if (lastSeenAt) return `Last seen ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`
  return 'Offline'
}
