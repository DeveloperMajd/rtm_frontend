import { useParams } from 'react-router-dom'
import MessageForm from './MessageForm'
import Messages from './Messages'
import useMessages from '../../hooks/useMessages'
import useTypingIndicator from '../../hooks/useTypingIndicator'

const ConversationRoom = () => {
  const { id } = useParams<{ id: string }>()
  const { messages, isLoading, isLoadingMore, hasMore, error, loadOlder } = useMessages(id!)
  const typingText = useTypingIndicator(id!)

  return (
    <div className='conversation-room-container w-full md:w-2/3 p-4 flex flex-col justify-between overflow-y-auto'>
      <Messages
        messages={messages}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        onLoadOlder={() => { void loadOlder() }}
      />
      <div className='h-5 px-1 text-sm text-gray-400 italic'>
        {typingText ?? ''}
      </div>
      <MessageForm conversationId={id!} />
    </div>
  )
}

export default ConversationRoom
