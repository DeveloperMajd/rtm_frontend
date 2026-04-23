import MessageForm from './MessageForm'
import Messages from './Messages'
import useMessages from '../hooks/useMessages'

const ConversationRoom = ({ conversationId }: { conversationId: number }) => {
  const { messages, isLoading, error, refetch } = useMessages(conversationId)

  return (
    <div>
      <Messages
        messages={messages}
        isLoading={isLoading}
        error={error}
      />
      <MessageForm
        conversationId={conversationId}
        onMessageSent={refetch}
      />
    </div>
  )
}

export default ConversationRoom
