import { useSyncExternalStore } from 'react'

/** How long someone shows as typing after their last ping. Pings come
 * every couple of seconds while they type (MessageForm). */
export const TYPING_SHOWN_MS = 3000

type Typist = { name: string; timer: ReturnType<typeof setTimeout> }

/** Who's typing where: conversation → user → typist. */
const typing = new Map<string, Map<string, Typist>>()
/** The same as names, one array per conversation, replaced on each change so
 * a row re-renders only when its own conversation's typists change. */
const names = new Map<string, readonly string[]>()
const listeners = new Set<() => void>()
const NOBODY: readonly string[] = []

function changed(conversationId: string): void {
  const typists = typing.get(conversationId)
  if (typists && typists.size > 0) {
    names.set(conversationId, [...typists.values()].map((typist) => typist.name))
  } else {
    typing.delete(conversationId)
    names.delete(conversationId)
  }
  for (const listener of listeners) listener()
}

/** Someone is typing in a conversation (TypingIndicator, on the viewer's
 * own channel): shown until they've gone quiet for TYPING_SHOWN_MS. */
export function noteTyping(conversationId: string, userId: string, name: string): void {
  const typists = typing.get(conversationId) ?? new Map<string, Typist>()
  const before = typists.get(userId)
  clearTimeout(before?.timer)
  typists.set(userId, { name, timer: setTimeout(() => stopTyping(conversationId, userId), TYPING_SHOWN_MS) })
  typing.set(conversationId, typists)
  // Another ping from someone already shown only keeps them a while longer:
  // nothing on screen changes, so nothing is told (a ping comes every couple
  // of seconds from everyone typing).
  if (before?.name !== name) changed(conversationId)
}

/** They've stopped: their message has arrived, or they've gone quiet. */
export function stopTyping(conversationId: string, userId: string): void {
  const typist = typing.get(conversationId)?.get(userId)
  if (!typist) return
  clearTimeout(typist.timer)
  typing.get(conversationId)?.delete(userId)
  changed(conversationId)
}

/** Nobody is typing anywhere, as far as this tab knows: the channel that
 * said so has closed (signing out). */
export function forgetTyping(): void {
  for (const typists of typing.values()) {
    for (const typist of typists.values()) clearTimeout(typist.timer)
  }
  typing.clear()
  names.clear()
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Who's typing in a conversation right now, by name, for its row in the
 * chat list and the line above an open room's composer (TypingLine). Told
 * over the viewer's own channel (see useUserChannel), so it works for every
 * conversation, open or not, without a subscription each.
 */
export function useListTyping(conversationId: string): readonly string[] {
  return useSyncExternalStore(subscribe, () => names.get(conversationId) ?? NOBODY)
}

/** What a row says while someone's typing (Study-Typing-Presence): a direct
 * conversation is the person, so just "typing…"; a group says who, or how
 * many. */
export function typingLabel(type: 'direct' | 'group', typists: readonly string[]): string {
  if (type === 'direct') return 'typing…'
  return typists.length === 1 ? `${typists[0]} is typing…` : `${typists.length} people typing…`
}

/** What the line above an open room's composer says (TypingLine): there's
 * room there to name two people. */
export function typingLine(typists: readonly string[]): string | null {
  if (typists.length === 0) return null
  if (typists.length === 1) return `${typists[0]} is typing…`
  if (typists.length === 2) return `${typists[0]} and ${typists[1]} are typing…`
  return 'Several people are typing…'
}
