import { formatDistanceToNow } from 'date-fns'
import type { PresenceStatus } from './baseTypes'

/** A person's presence as the API gives it: `presence_status` from a server
 * that knows about away, `is_online` from any. */
export type Presence = { is_online?: boolean; presence_status?: PresenceStatus }

/** Online, away (online, with the app left idle) or offline. */
export function presenceOf({ is_online, presence_status }: Presence): PresenceStatus {
  return presence_status ?? (is_online ? 'online' : 'offline')
}

/** "Online", "Away", "Last seen 3 hours ago", or "Offline" when there's no
 * record — the one-line presence under a person's name in lists and panels. */
export function presenceLabel(status: PresenceStatus, lastSeenAt?: string | null): string {
  if (status === 'online') return 'Online'
  if (status === 'away') return 'Away'
  if (lastSeenAt) return `Last seen ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`
  return 'Offline'
}
