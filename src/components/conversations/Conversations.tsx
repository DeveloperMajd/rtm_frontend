import { NavLink } from 'react-router-dom'
import type { ConversationType } from '../../utils/baseTypes'
import Spinner from '../ui/Spinner'
import { formatDistanceToNow } from 'date-fns'

const Conversations = ({
  conversations,
  isLoading,
  error,
}: {
  conversations: ConversationType[]
  isLoading: boolean
  error: Error | null
}) => {
  return (
    <div className='conversations-container w-full p-4 border-r border-gray-300 overflow-y-auto'>
      {isLoading && (
        <div className='flex p-2'>
          <Spinner
            position='left'
            size={40}
            color='#6E026F'
          />
        </div>
      )}
      {error && <p className='error-msg'>Error: {error.message}</p>}
      <ul className='flex justify-center flex-col'>
        {!isLoading && !error && conversations.length === 0 && (
          <li className='text-sm text-gray-500'>No conversations found.</li>
        )}
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <NavLink
              to={`/conversations/${conversation.id}`}
              className={({ isActive }) =>
                `conversation-item block border border-gray-300 rounded p-2 mb-2 cursor-pointer hover:bg-gray-100${isActive ? ' bg-gray-100' : ''}`
              }
            >
              <div className='flex items-center justify-between'>
                <span>
                  {conversation.type === 'group'
                    ? conversation.title || ''
                    : conversation.other_participant?.name || 'Direct Conversation'}
                </span>
                <span>
                  {(conversation.last_message_at || conversation.updated_at) && (
                    <time
                      data-datetime={
                        conversation.last_message_at || conversation.updated_at
                      }
                      className='text-sm text-gray-500 ml-2'
                    >
                      {formatDistanceToNow(
                        new Date(
                          conversation.last_message_at || conversation.updated_at,
                        ),
                        { includeSeconds: true },
                      ) + ' ago'}
                    </time>
                  )}
                </span>
              </div>

              <div className='flex items-center justify-between mt-1'>
                {conversation.latest_message && (
                  <p className='text-sm text-gray-600 truncate'>
                    {conversation.latest_message.body.length > 20
                      ? conversation.latest_message.body.substring(0, 20) + '...'
                      : conversation.latest_message.body}
                  </p>
                )}
                {!!conversation.unread_count && (
                  <span className='shrink-0 ml-2 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-medium'>
                    {conversation.unread_count}
                  </span>
                )}
              </div>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Conversations
