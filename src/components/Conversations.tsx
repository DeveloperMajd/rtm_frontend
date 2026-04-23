import useConversations from '../hooks/useConversations'
import { formatDate } from '../utils/date-formatter'
import Spinner from './UI/loaders/Spinner'

const Conversations = ({
  setSelectedConversation,
}: {
  setSelectedConversation: (conversationId: number) => void
}) => {
  const { conversations, isLoading, error } = useConversations()

  return (
    <div className='conversations-container w-full md:w-1/3 p-4 border-r border-gray-300 overflow-y-auto'>
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
      <ul className='flex justify-center'>
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
              <span className='text-sm text-gray-500 ml-2'>
                {formatDate(conversation.updated_at, 'MMMM dd, HH:mm')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Conversations
