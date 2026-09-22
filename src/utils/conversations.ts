import type { ConversationType } from './baseTypes'

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
