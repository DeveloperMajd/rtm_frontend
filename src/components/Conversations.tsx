import type { ConversationType } from '../utils/baseTypes'
import Spinner from './UI/loaders/Spinner'
import { formatDistanceToNow, format as formatDate } from 'date-fns'

const Conversations = ({
  conversations,
  isLoading,
  error,
  setSelectedConversation,
}: {
  conversations: ConversationType[]
  isLoading: boolean
  error: Error | null
  setSelectedConversation: (conversationId: number) => void
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
          <li
            key={conversation.id}
            className='conversation-item border border-gray-300 rounded p-2 mb-2 cursor-pointer hover:bg-gray-100'
            onClick={() => setSelectedConversation(conversation.id)}
          >
            {/* TODO: No title then show first 10 char from the last message */}
            {/* {conversation.title ||
              (conversation.last_message &&
                conversation.last_message.body.slice(0, 10) + '...') ||
              'Untitled Conversation'} */}
            {conversation.title || 'Untitled Conversation'}
            {conversation.last_message_at && (
              <span className='text-sm text-gray-500 ml-2'>
                {formatDate(conversation.last_message_at, 'MMMM dd, HH:mm')}
              </span>
            )}
            {conversation.updated_at && (
              <time
                data-datetime={conversation.updated_at}
                className='text-sm text-gray-500 ml-2'
              >
                {formatDistanceToNow(new Date(conversation.updated_at), {
                  includeSeconds: true,
                }) + ' ago'}
              </time>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Conversations
