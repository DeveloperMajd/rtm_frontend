import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MessageForm from './MessageForm'
import Messages from './Messages'
import GroupSettingsPanel from './GroupSettingsPanel'
import useMessages from '../../hooks/useMessages'
import useTypingIndicator from '../../hooks/useTypingIndicator'
import useConversations from '../../hooks/useConversations'
import useAuth from '../../hooks/useAuth'
import { useReadStateSnapshot } from '../../hooks/useReadStateSnapshot'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import OnlineStatus from '../ui/OnlineStatus'
import type { MessageType } from '../../utils/baseTypes'

const ConversationRoomView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    conversations,
    isLoading: isLoadingConversations,
    isReady: areConversationsReady,
  } = useConversations()
  const { user } = useAuth()
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null)

  const conversation = conversations.find((c) => c.id === id)
  const isGroup = conversation?.type === 'group'
  const hasLeft = Boolean(conversation?.viewer_left_at)

  // Covers a bad/nonexistent id and a group that just got deleted out from
  // under us (left/kicked-from groups stay in the list, frozen, so this
  // never fires for those).
  useEffect(() => {
    if (!isLoadingConversations && !conversation) {
      navigate('/conversations', { replace: true })
    }
  }, [isLoadingConversations, conversation, navigate])

  const {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadOlder,
    isReady: areMessagesReady,
    isRefreshing: areMessagesRefreshing,
  } = useMessages(id!, hasLeft, { deferUntilReady: !areConversationsReady })
  const typingText = useTypingIndicator(id!, !hasLeft)
  const readState = useReadStateSnapshot(
    id,
    areConversationsReady,
    conversation?.unread_count,
    conversation?.last_read_message_id,
  )

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
          <Icon name='arrowLeft' />
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
              {(() => {
                const count = (conversation?.participants ?? []).filter((p) => !p.left_at).length
                return `${count} ${count === 1 ? 'member' : 'members'}`
              })()}
            </span>
          )}
        </div>

        {isGroup && !hasLeft && (
          <Button variant='ghost' onClick={() => setIsGroupSettingsOpen(true)}>
            Manage
          </Button>
        )}
      </header>

      {/* No key needed here: the whole room is keyed by conversation id
          (see the wrapper at the bottom of this file), so this remounts and
          resets its scroll position, unread divider and new-message count
          along with everything else. */}
      <Messages
        messages={messages}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        onLoadOlder={loadOlder}
        onReply={setReplyingTo}
        readOnly={hasLeft}
        readState={readState}
        isReady={areMessagesReady}
        isRefreshing={areMessagesRefreshing}
      />

      {!hasLeft && (
        <div className='typing-line' aria-live='polite'>
          {typingText && (
            <>
              <span className='typing-bars' aria-hidden='true'>
                <i />
                <i />
                <i />
                <i />
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

/**
 * Keyed by conversation id so that switching conversations is a real mount
 * rather than a re-render with new params.
 *
 * The router reuses one element for /conversations/:id, so without this the
 * room — and every hook in it — survives a switch, carrying over the
 * previous conversation's scroll position, unread divider, snapshot and
 * "has this mount fetched yet" state. It also left the data hooks holding a
 * single query observer that merely swapped keys, which is the one path
 * TanStack Query decides by staleness alone (see useMessages), so returning
 * to a conversation re-used its cache without ever re-checking the server.
 */
const ConversationRoom = () => {
  const { id } = useParams<{ id: string }>()
  return <ConversationRoomView key={id} />
}

export default ConversationRoom
