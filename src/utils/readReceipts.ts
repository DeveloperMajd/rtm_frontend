import type { QueryClient } from '@tanstack/react-query'
import type { ReadPointer, ReadStretch } from '../services/api/conversations'

/** Everyone's read pointers in one conversation (see useReadPointers). */
export const readPointersKey = (conversationId: string) => ['reads', conversationId] as const

/** Every open "Message info" in one conversation (see useMessageInfo): the
 * prefix a live read refreshes them all by. */
export const messageInfoKey = (conversationId: string) => ['message-info', conversationId] as const

/** Is pointer `a` further along than `b`? Ids are UUIDv7, ordered by time
 * as strings, which is how the server compares them too. */
const isAhead = (a: string | null, b: string | null) => a !== null && (b === null || a > b)

/**
 * Takes a pointer that arrived live (the ConversationRead event) into the
 * cached list — only if it's further along than what's there, and with the
 * stretches it carries, which say how much of it was shared. The viewer's
 * own side of it stays as it was fetched. Broadcasts are queued and can
 * arrive out of order; the furthest pointer is always the true one, since
 * the server never moves one back.
 */
export function applyReadPointer(queryClient: QueryClient, conversationId: string, pointer: ReadPointer): void {
  queryClient.setQueryData<ReadPointer[]>(readPointersKey(conversationId), (old) => {
    if (!old) return old
    const current = old.find((p) => p.user_id === pointer.user_id)
    if (!current) return [...old, pointer]
    if (!isAhead(pointer.last_read_message_id, current.last_read_message_id)) return old
    return old.map((p) =>
      p.user_id === pointer.user_id ? { ...pointer, viewer_stretches: current.viewer_stretches } : p,
    )
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
 * Whether the viewer may see that someone has read a message: it lies both
 * in one of the stretches they read with read receipts on and in one of the
 * viewer's stretches of them — read while both had receipts on. An open
 * stretch runs to the pointer the viewer was given. A read made while
 * either had them off is outside one or the other, so it never counts,
 * however either switches later. The server applies the same rule
 * (ReadReceiptVisibility::covers). Ids are UUIDv7, ordered by time as
 * strings.
 */
export function covers(pointer: ReadPointer, messageId: string): boolean {
  const end = pointer.last_read_message_id
  const within = (stretches: ReadStretch[] = [[null, null]]) =>
    stretches.some(([from, to]) => {
      const last = to ?? end
      return last !== null && (from === null || messageId > from) && messageId <= last
    })
  return within(pointer.stretches) && within(pointer.viewer_stretches)
}

/**
 * What the viewer's message says about who has read it
 * (Study-Read-State): in a direct conversation "Seen" once the other
 * person has read it, in a group "Seen by N" with who's who. Reading a later
 * message counts — pointers only move forward past everything before them —
 * as long as both reads were shared (see covers).
 */
export function receiptFor(
  messageId: string,
  readers: Reader[],
  pointers: ReadPointer[],
  isGroup: boolean,
): Receipt {
  const hasRead = (reader: Reader) => {
    const pointer = pointers.find((p) => p.user_id === reader.user_id)
    return pointer !== undefined && covers(pointer, messageId)
  }

  const seen = readers.filter(hasRead)
  if (seen.length === 0) return { kind: 'sent' }
  if (!isGroup) return { kind: 'seen' }
  return { kind: 'seen-by', seen, notYet: readers.filter((reader) => !hasRead(reader)) }
}
