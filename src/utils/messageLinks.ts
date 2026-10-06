/** Where one message is in the app: its conversation, jumped to it (see
 * ConversationRoom's `?message=`). */
export const messagePath = (conversationId: string, messageId: string) =>
  `/conversations/${encodeURIComponent(conversationId)}?message=${encodeURIComponent(messageId)}`

/**
 * A link to one message that can be shared (Copy link): short, and kept
 * apart from the app's own routes, so it keeps working however those
 * change. /c/…/m/… resolves to messagePath once the viewer is signed in.
 */
export const messageLink = (conversationId: string, messageId: string, origin = window.location.origin) =>
  `${origin}/c/${encodeURIComponent(conversationId)}/m/${encodeURIComponent(messageId)}`
