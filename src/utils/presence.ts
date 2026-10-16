import { formatDistanceToNow } from 'date-fns'
import type { QueryClient } from '@tanstack/react-query'
import type { ContactType, ConversationType, PresenceStatus } from './baseTypes'

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

/** Someone's presence changing, as the server pushes it (PresenceChanged). */
export type PresenceChange = { user_id: string; presence_status: PresenceStatus; is_online: boolean }

/**
 * Puts a pushed change into every cached list that shows the person — the
 * conversation list (a direct chat's other person, a group's members) and
 * the contacts — so their dot changes at once. Lists that don't show them
 * are left as they were, object for object.
 */
export function applyPresenceChange(queryClient: QueryClient, change: PresenceChange): void {
  const presence = { is_online: change.is_online, presence_status: change.presence_status }

  queryClient.setQueryData<{ data: ConversationType[] }>(['conversations'], (old) => {
    if (!old) return old
    return {
      ...old,
      data: old.data.map((conversation) => {
        const other = conversation.other_participant
        const participants = conversation.participants
        const otherIsThem = other?.id === change.user_id
        const amongThem = participants?.some((p) => p.user_id === change.user_id) ?? false
        if (!otherIsThem && !amongThem) return conversation
        return {
          ...conversation,
          other_participant: otherIsThem && other ? { ...other, ...presence } : other,
          participants: amongThem
            ? participants?.map((p) => (p.user_id === change.user_id ? { ...p, ...presence } : p))
            : participants,
        }
      }),
    }
  })

  queryClient.setQueryData<ContactType[]>(['contacts'], (old) =>
    old?.map((contact) => (contact.id === change.user_id ? { ...contact, ...presence } : contact)),
  )
}
