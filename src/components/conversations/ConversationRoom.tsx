import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MessageForm from './MessageForm'
import Messages from './Messages'
import GroupSettingsPanel from './GroupSettingsPanel'
import useMessages from '../../hooks/useMessages'
import useTypingIndicator from '../../hooks/useTypingIndicator'
import useConversations from '../../hooks/useConversations'
import useAuth from '../../hooks/useAuth'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import OnlineStatus from '../ui/OnlineStatus'
import type { MessageType } from '../../utils/baseTypes'

const ConversationRoom = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { messages, isLoading, isLoadingMore, hasMore, error, loadOlder } = useMessages(id!)
  const typingText = useTypingIndicator(id!)
  const { conversations } = useConversations()
  const { user } = useAuth()
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null)

  const conversation = conversations.find((c) => c.id === id)
  const isGroup = conversation?.type === 'group'
  const hasLeft = Boolean(conversation?.viewer_left_at)

  const headerTitle = isGroup
    ? conversation?.title || 'Untitled group'
    : conversation?.other_participant?.name || 'Direct conversation'

  return (
    <section className='room' aria-label={headerTitle}>
      <header className='room__header'>
        <Button
          variant='ghost'
          icon
          className='room__back'
          aria-label='Back to conversations'
          onClick={() => navigate('/conversations')}
        >
          <span aria-hidden='true'>←</span>
        </Button>

        <Avatar
          name={headerTitle}
          src={isGroup ? null : conversation?.other_participant?.avatar_url}
          kind={isGroup ? 'group' : 'user'}
          size='sm'
          online={isGroup ? undefined : conversation?.other_participant?.is_online}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className='room__title'>{headerTitle}</div>
          {!isGroup && conversation?.other_participant && (
            <OnlineStatus
              isOnline={conversation.other_participant.is_online}
              lastSeenAt={conversation.other_participant.last_seen_at}
              showLabel
            />
          )}
          {isGroup && (
            <span className='muted' style={{ fontSize: '0.75rem' }}>
              {(conversation?.participants ?? []).filter((p) => !p.left_at).length} members
            </span>
          )}
        </div>

        {isGroup && !hasLeft && (
          <Button variant='ghost' onClick={() => setIsGroupSettingsOpen(true)}>
            Manage
          </Button>
        )}
      </header>

      <div className='room__scroll scroll-y'>
        <Messages
          messages={messages}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          error={error}
          onLoadOlder={() => {
            void loadOlder()
          }}
          onReply={setReplyingTo}
          readOnly={hasLeft}
        />
      </div>

      {!hasLeft && (
        <div className='typing-line' aria-live='polite'>
          {typingText && (
            <>
              <span className='typing-dots' aria-hidden='true'>
                <span />
                <span />
                <span />
              </span>{' '}
              {typingText}
            </>
          )}
        </div>
      )}

      {hasLeft ? (
        <div className='room__locked'>
          You can&rsquo;t send messages to this group because you&rsquo;re no longer a participant.
        </div>
      ) : (
        <div className='room__composer'>
          <MessageForm
            conversationId={id!}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </div>
      )}

      {conversation && user && (
        <GroupSettingsPanel
          open={isGroupSettingsOpen}
          conversation={conversation}
          currentUserId={user.id}
          onClose={() => setIsGroupSettingsOpen(false)}
        />
      )}
    </section>
  )
}

export default ConversationRoom
