import MessageForm from './MessageForm'
import Messages from './Messages'
import useMessages from '../hooks/useMessages'

const ConversationRoom = ({ conversationId }: { conversationId: number }) => {
  const { messages, isLoading, isLoadingMore, hasMore, error, refetch, loadOlder } = useMessages(conversationId)

  return (
    <div>
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
