import { NavLink } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { ConversationType } from '../../utils/baseTypes'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { ConversationListSkeleton } from '../ui/Skeleton'
import { systemMessageText } from '../../utils/systemMessageText'
import useAuth from '../../hooks/useAuth'
import { conversationTitle } from '../../utils/conversations'

export type ConversationFilter = 'all' | 'unread' | 'groups' | 'direct'

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

type ConversationsProps = {
  conversations: ConversationType[]
  isLoading: boolean
  error: Error | null
  filter?: ConversationFilter
  /** The ways out of an empty list — each button shows only when given. */
  onShowAll?: () => void
  onAddContact?: () => void
  onNewGroup?: () => void
  onRetry?: () => void
}

const Conversations = ({
  conversations,
  isLoading,
  error,
  filter = 'all',
  onShowAll,
  onAddContact,
  onNewGroup,
  onRetry,
}: ConversationsProps) => {
  const { user } = useAuth()

  if (isLoading && conversations.length === 0) {
    return <ConversationListSkeleton />
  }

  // Only when there's nothing to show instead: a failed background refresh
  // leaves the list it already has on screen (the next poll tries again).
  if (error && conversations.length === 0) {
    return (
      <EmptyState
        icon='wifiOff'
        tone='danger'
        title='Couldn’t load your chats'
        actions={
          onRetry && (
            <Button variant='secondary' className='sm' onClick={onRetry}>
              <Icon name='refresh' size={14} />
              Try again
            </Button>
          )
        }
      >
        Check your connection and try again. Nothing was lost.
      </EmptyState>
    )
  }

  const filtered = conversations.filter((c) => matchesFilter(c, filter))

  if (filtered.length === 0) {
    const addContact = onAddContact && (
      <Button variant={filter === 'all' || filter === 'direct' ? 'primary' : 'secondary'} className='sm' onClick={onAddContact}>
        <Icon name='userPlus' size={14} />
        Add contact
      </Button>
    )
    const newGroup = onNewGroup && (
      <Button variant={filter === 'groups' ? 'primary' : 'secondary'} className='sm' onClick={onNewGroup}>
        <Icon name='users' size={14} />
        New group
      </Button>
    )

    // States-Empty: a new account, then one per filter.
    switch (filter) {
      case 'all':
        return (
          <EmptyState
            icon='chat'
            title='No conversations yet'
            actions={(addContact || newGroup) && <>{addContact}{newGroup}</>}
          >
            Add a contact to start a direct chat, or create a group.
          </EmptyState>
        )
      case 'unread':
        return (
          <EmptyState
            icon='checks'
            title='You’re all caught up'
            actions={
              onShowAll && (
                <Button variant='secondary' className='sm' onClick={onShowAll}>
                  Show all
                </Button>
              )
            }
          >
            No unread conversations right now.
          </EmptyState>
        )
      case 'groups':
        return (
          <EmptyState icon='users' title='No groups yet' actions={newGroup}>
            Groups let you talk with several people at once, with admins.
          </EmptyState>
        )
      case 'direct':
        return (
          <EmptyState icon='user' title='No direct chats yet' actions={addContact}>
            Add a contact and your chat with them opens right away.
          </EmptyState>
        )
    }
  }

  return (
    <ul>
      {filtered.map((c) => {
        const title = conversationTitle(c)
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
