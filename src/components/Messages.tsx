import useMessages from '../hooks/useMessages'

const Messages = ({ conversationId }: { conversationId: number }) => {
  const { messages, isLoading, error } = useMessages(conversationId)
  console.log("🚀 ~ messages.tsx:5 ~ Messages ~ messages:", messages)

  return (
    <div>
      <h2>Messages for Conversation {conversationId}</h2>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      <ul className='flex justify-center'>
        {messages && messages.length === 0 && <p>No messages found.</p>}
        {messages &&
          messages.map((message) => (
            <li
              key={message.id}
              className='message-item border border-gray-300 rounded p-2 mb-2'
            >
              {message.body}
              {message.created_at && (
                <span className='text-sm text-gray-500 ml-2'>
                  {new Date(message.created_at).toLocaleString()}
                </span>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}

export default Messages
