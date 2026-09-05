import { useState } from 'react'
import { useParams } from 'react-router-dom'
import MessageForm from './MessageForm'
import Messages from './Messages'
import GroupSettingsPanel from './GroupSettingsPanel'
import useMessages from '../../hooks/useMessages'
import useTypingIndicator from '../../hooks/useTypingIndicator'
import useConversations from '../../hooks/useConversations'
import useAuth from '../../hooks/useAuth'
import OnlineStatus from '../ui/OnlineStatus'
import type { MessageType } from '../../utils/baseTypes'

const ConversationRoom = () => {
  const { id } = useParams<{ id: string }>()
  const { messages, isLoading, isLoadingMore, hasMore, error, loadOlder } = useMessages(id!)
  const typingText = useTypingIndicator(id!)
  const { conversations } = useConversations()
  const { user } = useAuth()
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null)

  const conversation = conversations.find((c) => c.id === id)

  return (
    <div className='conversation-room-container w-full md:w-2/3 p-4 flex flex-col justify-between overflow-y-auto'>
      {conversation?.type === 'group' && (
        <div className='flex items-center justify-between mb-2 pb-2 border-b border-gray-200'>
          <span className='font-medium text-gray-800'>{conversation.title}</span>
          <button
            type='button'
            onClick={() => setIsGroupSettingsOpen(true)}
            className='text-sm text-blue-500 hover:underline'
          >
            Manage group
          </button>
        </div>
      )}
      {conversation?.type === 'direct' && conversation.other_participant && (
        <div className='flex flex-col mb-2 pb-2 border-b border-gray-200'>
          <span className='font-medium text-gray-800'>{conversation.other_participant.name}</span>
          <OnlineStatus
            isOnline={conversation.other_participant.is_online}
            lastSeenAt={conversation.other_participant.last_seen_at}
            showLabel
          />
        </div>
      )}
      <Messages
        messages={messages}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        onLoadOlder={() => { void loadOlder() }}
        onReply={setReplyingTo}
      />
      <div className='h-5 px-1 text-sm text-gray-400 italic'>
        {typingText ?? ''}
      </div>
      <MessageForm
        conversationId={id!}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {isGroupSettingsOpen && conversation && user && (
        <GroupSettingsPanel
          conversation={conversation}
          currentUserId={user.id}
          onClose={() => setIsGroupSettingsOpen(false)}
        />
      )}
    </div>
  )
}

export default ConversationRoom
