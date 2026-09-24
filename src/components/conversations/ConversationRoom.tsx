import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MessageForm, { type MessageFormHandle } from './MessageForm'
import { ACCEPTED_SUMMARY } from '../../utils/attachments'
import Messages from './Messages'
import GroupInfoPanel from './GroupInfoPanel'
import ContactInfoPanel from './ContactInfoPanel'
import InfoPanel from './InfoPanel'
import useMessages from '../../hooks/useMessages'
import useTypingIndicator from '../../hooks/useTypingIndicator'
import useConversations from '../../hooks/useConversations'
import useAuth from '../../hooks/useAuth'
import { useReadStateSnapshot } from '../../hooks/useReadStateSnapshot'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import OnlineStatus from '../ui/OnlineStatus'
import Tooltip from '../ui/Tooltip'
import Badge from '../ui/Badge'
import { format } from 'date-fns'
import type { MessageType } from '../../utils/baseTypes'

const ConversationRoomView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { conversations, isReady: areConversationsReady } = useConversations()
  const { user } = useAuth()
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const infoToggleRef = useRef<HTMLButtonElement>(null)
  const infoPanelId = `info-panel-${id}`
  const closeInfo = () => {
    setIsInfoOpen(false)
    infoToggleRef.current?.focus()
  }
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null)
  const [editing, setEditing] = useState<MessageType | null>(null)
  const composerRef = useRef<MessageFormHandle>(null)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  // dragenter/dragleave fire for every child the pointer crosses, so count
  // them rather than trusting the last one.
  const dragDepth = useRef(0)

  // The composer does one thing at a time: starting a reply ends an edit,
  // and starting an edit drops a pending reply.
  const startReply = (message: MessageType) => {
    setEditing(null)
    setReplyingTo(message)
  }
  const startEdit = (message: MessageType) => {
    setReplyingTo(null)
    setEditing(message)
  }

  const conversation = conversations.find((c) => c.id === id)
  const isGroup = conversation?.type === 'group'
  const hasLeft = Boolean(conversation?.viewer_left_at)

  // Dragging files over the conversation turns the whole pane into a drop
  // target (Attach-Composer); dropped files go through the composer's own
  // checks. Only while there's a composer to take them — not in a group the
  // viewer has left, and not mid-edit (an edit can't carry attachments).
  const canDropFiles = !hasLeft && !editing
  const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!canDropFiles || !carriesFiles(e)) return
      e.preventDefault()
      dragDepth.current += 1
      setIsDraggingFiles(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!canDropFiles || !carriesFiles(e)) return
      // Required for the drop to be allowed at all.
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setIsDraggingFiles(false)
    },
    onDrop: (e: DragEvent) => {
      dragDepth.current = 0
      setIsDraggingFiles(false)
      if (!canDropFiles || !carriesFiles(e)) return
      e.preventDefault()
      composerRef.current?.addFiles(Array.from(e.dataTransfer.files))
    },
  }

  // Covers a bad/nonexistent id and a group that just got deleted out from
  // under us (left/kicked-from groups stay in the list, frozen, so this
  // never fires for those).
  //
  // Only decided once this mount has fetched the list itself. Going by the
  // cached copy bounced every brand-new conversation straight back out:
  // creating a group or adding a contact navigates here at once, before the
  // refetch that brings the new conversation in has landed.
  useEffect(() => {
    if (areConversationsReady && !conversation) {
      navigate('/conversations', { replace: true })
    }
  }, [areConversationsReady, conversation, navigate])

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
    <div className={`room-shell${isInfoOpen ? ' has-panel' : ''}`}>
      <section className='room' aria-label={headerTitle} {...dropHandlers}>
        {isDraggingFiles && (
          // Pointer-only affordance: the attach button is the keyboard path.
          <div className='drop-overlay' aria-hidden='true'>
            <span className='drop-overlay__icon'>
              <Icon name='upload' size={22} />
            </span>
            <span className='drop-overlay__title'>Drop to attach</span>
            <span className='drop-overlay__hint'>{ACCEPTED_SUMMARY}</span>
          </div>
        )}

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
                  const members = `${count} ${count === 1 ? 'member' : 'members'}`
                  // Neutral on purpose: the API doesn't say whether the viewer
                  // left or was removed.
                  return hasLeft ? `No longer a member · ${members}` : members
                })()}
              </span>
            )}
          </div>

          {/* Searching inside one conversation (Search-InConversation) needs a
              conversation-scoped search and jump-to-message API — Phase 2.
              The entry point is here, honestly disabled, until then. */}
          <Tooltip label='Search this conversation — Soon'>
            <Button variant='ghost' icon disabled aria-label='Search this conversation (coming soon)'>
              <Icon name='search' />
            </Button>
          </Tooltip>

          {conversation && (
            <Tooltip label={isGroup ? 'Group info' : 'Contact info'}>
              <Button
                ref={infoToggleRef}
                variant='ghost'
                icon
                className='room__panel-toggle'
                aria-label={isGroup ? 'Group info' : 'Contact info'}
                aria-expanded={isInfoOpen}
                aria-controls={isInfoOpen ? infoPanelId : undefined}
                onClick={() => (isInfoOpen ? closeInfo() : setIsInfoOpen(true))}
              >
                <Icon name='panelRight' />
              </Button>
            </Tooltip>
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
          onReply={startReply}
          onEdit={startEdit}
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
            <div className='locked-card' role='note'>
              <span className='locked-card__icon' aria-hidden='true'>
                <Icon name='lock' size={18} />
              </span>
              <div className='locked-card__text'>
                <p className='locked-card__title'>You’re no longer in this group</p>
                <p className='locked-card__body'>
                  You can read the history
                  {conversation?.viewer_left_at
                    ? ` up to ${format(new Date(conversation.viewer_left_at), 'd MMM, HH:mm')}`
                    : ''}
                  , but can’t send messages or react.
                </p>
              </div>
              <Badge tone='left'>Read-only</Badge>
            </div>
          </div>
        ) : (
          <div className='room__composer'>
            <MessageForm
              ref={composerRef}
              conversationId={id!}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              editing={editing}
              onFinishEdit={() => setEditing(null)}
            />
          </div>
        )}

      </section>

      {isInfoOpen && conversation && user && (
        <InfoPanel id={infoPanelId} title={isGroup ? 'Group info' : 'Contact'} onClose={closeInfo}>
          {isGroup ? (
            <GroupInfoPanel conversation={conversation} currentUserId={user.id} readOnly={hasLeft} />
          ) : (
            <ContactInfoPanel conversation={conversation} conversations={conversations} />
          )}
        </InfoPanel>
      )}
    </div>
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
