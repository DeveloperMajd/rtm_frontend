import type { ConversationType } from './baseTypes'

/** What a conversation is called in the UI: a group's title, or the other
 * person's name in a direct chat. */
export function conversationTitle(c: ConversationType): string {
  return c.type === 'group'
    ? c.title || 'Untitled group'
    : c.other_participant?.name || 'Direct conversation'
}

/** Unread messages across the viewer's conversations — optionally leaving
 * one out (the one on screen). A group the viewer has left doesn't count:
 * nothing new can arrive there for them. */
export function unreadTotal(conversations: ConversationType[], exceptId?: string): number {
  return conversations.reduce(
    (total, c) => (c.id !== exceptId && !c.viewer_left_at ? total + (c.unread_count ?? 0) : total),
    0,
  )
}

/**
 * The backend returns conversations in no particular order (no `ORDER BY`
 * on the endpoint) — sort by most recent activity so the list is at least
 * stable and recency-ordered. Nothing is "pinned" yet (a Phase 2 feature),
 * so this is the whole ordering for now.
 */
export function sortByRecency(conversations: ConversationType[]): ConversationType[] {
  return [...conversations].sort((a, b) => {
    const aTime = new Date(a.last_message_at ?? a.updated_at).getTime()
    const bTime = new Date(b.last_message_at ?? b.updated_at).getTime()
    return bTime - aTime
  })
}
