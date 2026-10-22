import type { ReadPointer } from '../services/api/conversations'
import type { MessageType } from './baseTypes'

/**
 * What an open conversation hears about itself, by event.
 *
 * A conversation has no channel of its own: the server sends everything that
 * happens in it to each current member's own channel, deciding who that is
 * as it sends, so someone removed from a group stops hearing it at once.
 * (Channel access is checked only when a socket subscribes, so a channel
 * per conversation kept a removed member's socket listening.) The viewer's
 * channel has one owner, useUserChannel, which hands each event to the open
 * room through here.
 */
export type RoomEvents = {
  MessageSent: MessageType
  MessageUpdated: MessageType
  MessageReactionUpdated: MessageType
  ConversationRead: ReadPointer
  TypingIndicator: { user_id: string; name: string }
}

export type RoomListeners = { [Event in keyof RoomEvents]?: (payload: RoomEvents[Event]) => void }

const listening = new Set<{ conversationId: string; listeners: RoomListeners }>()

/** Hears `conversationId`'s events until the returned function is called. */
export function listenToRoom(conversationId: string, listeners: RoomListeners): () => void {
  const entry = { conversationId, listeners }
  listening.add(entry)
  return () => {
    listening.delete(entry)
  }
}

/** Hands an event to whoever has `conversationId` open; nobody, if no one has. */
export function tellRoom<Event extends keyof RoomEvents>(
  conversationId: string,
  event: Event,
  payload: RoomEvents[Event],
): void {
  for (const entry of listening) {
    if (entry.conversationId === conversationId) entry.listeners[event]?.(payload)
  }
}
