import type { QueryClient } from '@tanstack/react-query'
import type { ReadPointer } from '../services/api/conversations'

/** Everyone's read pointers in one conversation (see useReadPointers). */
export const readPointersKey = (conversationId: string) => ['reads', conversationId] as const

/** Is pointer `a` further along than `b`? Ids are UUIDv7, ordered by time
 * as strings, which is how the server compares them too. */
const isAhead = (a: string | null, b: string | null) => a !== null && (b === null || a > b)

/**
 * Takes a pointer that arrived live (the ConversationRead event) into the
 * cached list — only if it's further along than what's there. Broadcasts
 * are queued and can arrive out of order; the furthest pointer is always
 * the true one, since the server never moves one back.
 */
export function applyReadPointer(queryClient: QueryClient, conversationId: string, pointer: ReadPointer): void {
  queryClient.setQueryData<ReadPointer[]>(readPointersKey(conversationId), (old) => {
    if (!old) return old
    const current = old.find((p) => p.user_id === pointer.user_id)
    if (!current) return [...old, pointer]
    if (!isAhead(pointer.last_read_message_id, current.last_read_message_id)) return old
    return old.map((p) => (p.user_id === pointer.user_id ? pointer : p))
  })
}

/** Someone who could read the viewer's message: everyone else still in the
 * conversation. */
export type Reader = { user_id: string; name: string; avatar_url?: string | null }

export type Receipt =
  /** Accepted by the server; nobody has read it yet. */
  | { kind: 'sent' }
  /** Direct conversation: the other person has read it. */
  | { kind: 'seen' }
  /** Group: some or all of the others have read it. */
  | { kind: 'seen-by'; seen: Reader[]; notYet: Reader[] }

/**
 * What the viewer's message says about who has read it
 * (Study-Read-State): in a direct conversation "Seen" once the other
 * person's pointer has reached it, in a group "Seen by N" with who's who.
 * Reading a later message counts — pointers only move forward past
 * everything before them.
 */
export function receiptFor(
  messageId: string,
  readers: Reader[],
  pointers: ReadPointer[],
  isGroup: boolean,
): Receipt {
  const pointerOf = (userId: string) => pointers.find((p) => p.user_id === userId)?.last_read_message_id ?? null
  const hasRead = (reader: Reader) => {
    const pointer = pointerOf(reader.user_id)
    return pointer !== null && pointer >= messageId
  }

  const seen = readers.filter(hasRead)
  if (seen.length === 0) return { kind: 'sent' }
  if (!isGroup) return { kind: 'seen' }
  return { kind: 'seen-by', seen, notYet: readers.filter((reader) => !hasRead(reader)) }
}
