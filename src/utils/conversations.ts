import type { QueryClient } from '@tanstack/react-query'
import type { ConversationType } from './baseTypes'

/** What a conversation is called in the UI: a group's title, or the other
 * person's name in a direct chat. */
export function conversationTitle(c: ConversationType): string {
  return c.type === 'group'
    ? c.title || 'Untitled group'
    : c.other_participant?.name || 'Direct conversation'
}

/** Unread messages across the viewer's conversations, for the badges that
 * add them up (the rail, the Unread filter, the back button) — optionally
 * leaving one out (the one on screen).
 *
 * Counts only conversations the viewer wants to hear about: not a muted
 * one, not an archived one, and not a group they've left (nothing new can
 * arrive there for them). Each conversation's own count stays true on its
 * row either way. */
export function unreadTotal(conversations: ConversationType[], exceptId?: string): number {
  return conversations.reduce(
    (total, c) =>
      c.id !== exceptId && !c.viewer_left_at && !c.muted_at && !c.archived_at ? total + (c.unread_count ?? 0) : total,
    0,
  )
}

/**
 * The list's order: pinned conversations first, then the rest, each by
 * most recent activity. The API sends them in this order, but the list is
 * also patched in place as messages arrive, which can change the order
 * without a refetch — so the client sorts too.
 */
export function sortConversations(conversations: ConversationType[]): ConversationType[] {
  return [...conversations].sort((a, b) => {
    const pinned = Number(Boolean(b.pinned_at)) - Number(Boolean(a.pinned_at))
    if (pinned !== 0) return pinned
    const aTime = new Date(a.last_message_at ?? a.updated_at).getTime()
    const bTime = new Date(b.last_message_at ?? b.updated_at).getTime()
    return bTime - aTime
  })
}

type ConversationsResponse = { data: ConversationType[] }

/** Changes one conversation in the cached list — from a pin, mute or
 * archive, made here or in another tab. */
export function patchConversationInCache(
  queryClient: QueryClient,
  conversationId: string,
  patch: Partial<ConversationType>,
): void {
  queryClient.setQueryData<ConversationsResponse>(['conversations'], (old) => {
    if (!old) return old
    return { ...old, data: old.data.map((c) => (c.id === conversationId ? { ...c, ...patch } : c)) }
  })
}
