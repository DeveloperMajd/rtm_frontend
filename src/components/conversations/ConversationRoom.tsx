import { useParams } from 'react-router-dom'
import MessageForm from './MessageForm'
import Messages from './Messages'
import useMessages from '../../hooks/useMessages'

const ConversationRoom = () => {
  const { id } = useParams<{ id: string }>()
  const { messages, isLoading, isLoadingMore, hasMore, error, loadOlder } = useMessages(id!)

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
      <MessageForm conversationId={id!} />
    </div>
  )
}

export default ConversationRoom
