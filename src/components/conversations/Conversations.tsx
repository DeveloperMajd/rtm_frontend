import { NavLink } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { ConversationType } from '../../utils/baseTypes'
import Avatar from '../ui/Avatar'
import { ConversationListSkeleton } from '../ui/Skeleton'

const titleFor = (c: ConversationType) =>
  c.type === 'group'
    ? c.title || 'Untitled group'
    : c.other_participant?.name || 'Direct conversation'

const Conversations = ({
  conversations,
  isLoading,
  error,
}: {
  conversations: ConversationType[]
  isLoading: boolean
  error: Error | null
}) => {
  if (isLoading && conversations.length === 0) {
    return <ConversationListSkeleton />
  }

  if (error) {
    return <p className='empty-state'>Couldn&rsquo;t load conversations: {error.message}</p>
  }

  if (conversations.length === 0) {
    return <p className='empty-state'>No conversations yet.</p>
  }

  return (
    <ul>
      {conversations.map((c) => {
        const title = titleFor(c)
        const when = c.last_message_at || c.updated_at
        const left = Boolean(c.viewer_left_at)

        return (
          <li key={c.id}>
            <NavLink
              to={`/conversations/${c.id}`}
              className={({ isActive }) =>
                `conversation-item${isActive ? ' is-active' : ''}${left ? ' is-left' : ''}`
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
                  <span className='conversation-item__preview'>
                    {left
                      ? 'You left this group'
                      : c.latest_message
                        ? `${c.latest_message.sender_name ? c.latest_message.sender_name + ': ' : ''}${c.latest_message.body}`
                        : 'No messages yet'}
                  </span>
                  {!left && !!c.unread_count && (
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
          </li>
        )
      })}
    </ul>
  )
}

export default Conversations
