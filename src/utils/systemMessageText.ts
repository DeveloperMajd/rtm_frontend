import type { MessageType, SystemEventType } from './baseTypes'

type Meta = {
  actor_id?: string
  actor_name?: string
  target_id?: string
  target_name?: string
  old_title?: string
  new_title?: string
}

/**
 * Render a system (group event) message to display text. Centralised here so
 * copy for "X added Y", "You left", etc. lives in one place rather than being
 * baked into the backend. `viewerId` lets us say "You" instead of a name.
 */
export function systemMessageText(message: MessageType, viewerId?: string): string {
  const meta = (message.metadata ?? {}) as Meta
  const event = message.event_type as SystemEventType | undefined

  const who = (id?: string, name?: string) =>
    id && viewerId && id === viewerId ? 'You' : name || 'Someone'

  const actor = who(meta.actor_id, meta.actor_name)
  const target = who(meta.target_id, meta.target_name)

  switch (event) {
    case 'group_created':
      return `${actor} created the group`
    case 'group_renamed':
      return meta.new_title
        ? `${actor} changed the group name to "${meta.new_title}"`
        : `${actor} changed the group name`
    case 'member_added':
      return `${actor} added ${target}`
    case 'member_left':
      return `${actor} left`
    case 'member_removed':
      return `${actor} removed ${target}`
    case 'member_promoted':
      return `${actor} made ${target} an admin`
    case 'member_demoted':
      return `${actor} removed ${target} as admin`
    default:
      return message.body || 'Group updated'
  }
}
