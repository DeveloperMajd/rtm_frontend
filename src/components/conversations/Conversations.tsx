import { NavLink } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { ConversationType } from '../../utils/baseTypes'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'
import { ConversationListSkeleton } from '../ui/Skeleton'
import { systemMessageText } from '../../utils/systemMessageText'
import useAuth from '../../hooks/useAuth'

export type ConversationFilter = 'all' | 'unread' | 'groups' | 'direct'

const titleFor = (c: ConversationType) =>
  c.type === 'group'
    ? c.title || 'Untitled group'
    : c.other_participant?.name || 'Direct conversation'

const previewFor = (c: ConversationType, viewerId?: string): string => {
  if (!c.latest_message) return 'No messages yet'
  if (c.latest_message.type === 'system') return systemMessageText(c.latest_message, viewerId)
  const { sender_name, body } = c.latest_message
  return `${sender_name ? sender_name + ': ' : ''}${body}`
}

const matchesFilter = (c: ConversationType, filter: ConversationFilter): boolean => {
  switch (filter) {
    case 'unread':
      return !c.viewer_left_at && !!c.unread_count
    case 'groups':
      return c.type === 'group'
    case 'direct':
      return c.type === 'direct'
    case 'all':
      return true
  }
}

const EMPTY_MESSAGE: Record<ConversationFilter, string> = {
  all: 'No conversations yet.',
  unread: 'No unread conversations.',
  groups: 'No group conversations.',
  direct: 'No direct conversations.',
}

/** A conversation row's Pin/Mute/Archive affordances — real controls, kept
 * disabled and tagged until the Phase 2 per-user preferences exist behind
 * them (see the design's own "Future-ready" feature map). Rendered as
 * siblings of the row's `NavLink`, not nested inside it — a `<button>`
 * inside an `<a>` is invalid HTML and breaks keyboard/AT navigation. */
const QuickActions = () => (
  <span className='conversation-item__quick-actions'>
    <Tooltip label='Pin conversation — Soon'>
      <button type='button' className='conversation-item__action' disabled aria-label='Pin conversation (coming soon)'>
        <Icon name='pin' size={14} />
      </button>
    </Tooltip>
    <Tooltip label='Mute conversation — Soon'>
      <button type='button' className='conversation-item__action' disabled aria-label='Mute conversation (coming soon)'>
        <Icon name='bellOff' size={14} />
      </button>
    </Tooltip>
    <Tooltip label='Archive conversation — Soon'>
      <button
        type='button'
        className='conversation-item__action'
        disabled
        aria-label='Archive conversation (coming soon)'
      >
        <Icon name='archive' size={14} />
      </button>
    </Tooltip>
  </span>
)

const Conversations = ({
  conversations,
  isLoading,
  error,
  filter = 'all',
}: {
  conversations: ConversationType[]
  isLoading: boolean
  error: Error | null
  filter?: ConversationFilter
}) => {
  const { user } = useAuth()

  if (isLoading && conversations.length === 0) {
    return <ConversationListSkeleton />
  }

  if (error) {
    return <p className='empty-state'>Couldn&rsquo;t load conversations: {error.message}</p>
  }

  const filtered = conversations.filter((c) => matchesFilter(c, filter))

  if (filtered.length === 0) {
    return <p className='empty-state'>{EMPTY_MESSAGE[filter]}</p>
  }

  return (
    <ul>
      {filtered.map((c) => {
        const title = titleFor(c)
        const when = c.last_message_at || c.updated_at
        const left = Boolean(c.viewer_left_at)
        const unread = !left && !!c.unread_count

        return (
          <li key={c.id} className='conversation-item-row'>
            <NavLink
              to={`/conversations/${c.id}`}
              className={({ isActive }) =>
                `conversation-item${isActive ? ' is-active' : ''}${left ? ' is-left' : ''}${unread ? ' has-unread' : ''}`
              }
            >
              <Avatar
                name={title}
                src={c.type === 'direct' ? c.other_participant?.avatar_url : null}
                kind={c.type === 'group' ? 'group' : 'user'}
                size='md'
                online={c.type === 'direct' ? c.other_participant?.is_online : undefined}
              />
              <div className='conversation-item__body'>
                <div className='conversation-item__top'>
                  <span className='conversation-item__title'>{title}</span>
                  {when && (
                    <time className='conversation-item__time' dateTime={when}>
                      {formatDistanceToNow(new Date(when), { addSuffix: true })}
                    </time>
                  )}
                </div>
                <div className='conversation-item__top'>
                  <span className='conversation-item__preview'>{previewFor(c, user?.id)}</span>
                  {unread && (
                    <span
                      className='unread-pill'
                      aria-label={`${c.unread_count} unread messages`}
                    >
                      {c.unread_count}
                    </span>
                  )}
                  {left && <span className='badge badge--left'>Left</span>}
                </div>
              </div>
            </NavLink>
            {!left && <QuickActions />}
          </li>
        )
      })}
    </ul>
  )
}

export default Conversations
