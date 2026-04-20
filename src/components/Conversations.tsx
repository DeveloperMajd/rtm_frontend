import useConversations from '../hooks/useConversations'

const Conversations = ({
  setSelectedConversation,
}: {
  setSelectedConversation: (conversationId: number) => void
}) => {
  const { conversations, isLoading, error } = useConversations()

  return (
    <div>
      <h2>Conversations</h2>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      <ul className='flex justify-center'>
        {conversations.map((conversation) => (
          <li
            key={conversation.id}
            className='conversation-item border border-gray-300 rounded p-2 mb-2 cursor-pointer hover:bg-gray-100'
            onClick={() => setSelectedConversation(conversation.id)}
          >
            {conversation.title || 'Untitled Conversation'}
            {conversation.last_message_at && (
              <span className='text-sm text-gray-500 ml-2'>
                {new Date(conversation.last_message_at).toLocaleString()}
              </span>
            )}
            {conversation.updated_at && (
              <span className='text-sm text-gray-500 ml-2'>
                {new Date(conversation.updated_at).toLocaleString()}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Conversations
