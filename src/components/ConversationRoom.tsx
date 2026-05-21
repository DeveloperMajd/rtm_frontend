import MessageForm from './Messages/MessageForm'
import Messages from './Messages/Messages'
import useMessages from '../hooks/useMessages'

const ConversationRoom = ({ conversationId }: { conversationId: number }) => {
  const { messages, isLoading, isLoadingMore, hasMore, error, refetch, loadOlder } = useMessages(conversationId)

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
      <MessageForm
        conversationId={conversationId}
        onMessageSent={refetch}
      />
    </div>
  )
}

export default ConversationRoom
