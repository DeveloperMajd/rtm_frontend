import type { MessageType } from './baseTypes'

/** The message a sheet is about, in a line or two. */
export function previewOf(message: MessageType): string {
  if (message.body) return message.body
  const count = message.attachments?.length ?? 0
  if (count > 1) return `${count} attachments`
  const first = message.attachments?.[0]
  return first ? (first.is_image ? 'Photo' : first.original_name) : ''
}
