import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { isAxiosError } from 'axios'
import MessageForm, { type MessageFormHandle } from './MessageForm'
import { ACCEPTED_SUMMARY } from '../../utils/attachments'
import Messages from './Messages'
import GroupInfoPanel from './GroupInfoPanel'
import ContactInfoPanel from './ContactInfoPanel'
import InfoPanel from './InfoPanel'
import ConnectionStrip from './ConnectionStrip'
import ConversationSearchBar from './ConversationSearchBar'
import useMessages from '../../hooks/useMessages'
import useTypingIndicator from '../../hooks/useTypingIndicator'
import useConversations from '../../hooks/useConversations'
import useReadPointers from '../../hooks/useReadPointers'
import useMissingConversation from '../../hooks/useMissingConversation'
import useAuth from '../../hooks/useAuth'
import { useReadStateSnapshot } from '../../hooks/useReadStateSnapshot'
import { useConversationSearch } from '../../hooks/useConversationSearch'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import OnlineStatus from '../ui/OnlineStatus'
import Tooltip from '../ui/Tooltip'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import ActionToast from '../ui/ActionToast'
import type { JumpTarget } from '../../hooks/useJumpHighlight'
import { format } from 'date-fns'
import { unreadTotal } from '../../utils/conversations'
import type { MessageType } from '../../utils/baseTypes'

/** What a jump to a message that couldn't be opened says (see below). */
type JumpFailure = { messageId: string; gone: boolean }

const ConversationRoomView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // `?message=` asks for a jump to one message (a search result, a link).
  // Opened with one, the room starts from a window around that message
  // straight away, rather than loading the newest messages first only to
  // swap them out.
  const requestedMessageId = searchParams.get('message')
  const [anchor, setAnchor] = useState<string | null>(requestedMessageId)
  const [jump, setJump] = useState<JumpTarget | null>(null)
  // After any jump, going back to the newest messages lands at the bottom:
  // the unread divider marked where reading had stopped when the room
  // opened, and the viewer has been elsewhere since.
  const [hasJumped, setHasJumped] = useState(false)
  const [jumpFailure, setJumpFailure] = useState<JumpFailure | null>(null)
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
  const unreadElsewhere = unreadTotal(conversations, id)

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

  // A bad or out-of-date link, or a group deleted out from under us (groups
  // the viewer left or was removed from stay in the list, frozen, so this
  // is never them). Said so in place (States-Errors "Not found") rather than
  // bouncing back to the list without a word.
  //
  // Only decided once this mount has fetched the list itself. Going by the
  // cached copy flagged every brand-new conversation: creating a group or
  // adding a contact navigates here at once, before the refetch that brings
  // the new conversation in has landed.
  const isUnavailable = areConversationsReady && !conversation
  // Not theirs: whether they're just not in it, or it's gone, is the
  // conversation's to say (see the screens below).
  const missing = useMissingConversation(id!, isUnavailable)
  // Whether it's the viewer's is the list's to say, cached or fresh. Its
  // messages and read state are asked for at once all the same: a fresh load
  // is nearly always a refresh, or a link into a conversation they're in,
  // and waiting for the list would hold up every one of those. A refusal
  // before the list has said is nobody's error, though — a link into a
  // conversation they're not in gets the screen below, not "Couldn't open
  // this conversation" or a failed jump's toast first. The live channel
  // waits for it, as useMessages's own subscription does.
  const isKnown = conversation !== undefined

  const {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isOlderError,
    retry,
    loadOlder,
    isReady: areMessagesReady,
    isRefreshing: areMessagesRefreshing,
    hasNewer,
    isLoadingNewer,
    isNewerError,
    loadNewer,
  } = useMessages(id!, hasLeft, { deferUntilReady: !areConversationsReady, enabled: !isUnavailable, anchor })
  // Held, behind the loading skeleton, until the list has said (see isKnown).
  const isErrorOnHold = error !== null && !isKnown
  const typingText = useTypingIndicator(id!, !hasLeft && isKnown)
  // Who could have read the viewer's messages, and how far each has.
  // Receipts belong to members only: someone who left sees the group as it
  // was, and their messages just say "Sent".
  const readPointers = useReadPointers(id!, !hasLeft && !isUnavailable)
  const readers = (conversation?.participants ?? [])
    .filter((p) => !p.left_at && p.user_id !== user?.id)
    .map((p) => ({ user_id: p.user_id, name: p.name, avatar_url: p.avatar_url }))
  const readState = useReadStateSnapshot(
    id,
    areConversationsReady,
    conversation?.unread_count,
    conversation?.last_read_message_id,
  )

  // --- Jumping to a message (a reply's original, a search result, a link) ---
  //
  // One already on screen is scrolled to where it is. Anything else opens a
  // window of history around it (see useMessages's anchor), which reads its
  // way back to the newest messages as the viewer scrolls down, or jumps
  // straight there from the "Jump to latest" pill.
  const jumpTo = (messageId: string, { focus = true }: { focus?: boolean } = {}) => {
    setJump((current) => ({ id: messageId, seq: (current?.seq ?? 0) + 1, focus }))
    setHasJumped(true)
    if (!messages.some((m) => m.id === messageId)) {
      setAnchor(messageId)
    }
  }

  const jumpToLatest = () => {
    setJump(null)
    setAnchor(null)
  }

  // Each new `?message=` is taken up once, as it appears. Adjusted during
  // render (React's pattern for state that follows other state), so a room
  // opened with one never renders a frame without the jump in hand.
  const [takenRequest, setTakenRequest] = useState<string | null>(null)
  if (requestedMessageId !== takenRequest) {
    setTakenRequest(requestedMessageId)
    if (requestedMessageId) jumpTo(requestedMessageId)
  }

  // …and then dropped from the address, so reloading or coming back to the
  // room doesn't jump again, and the same result can be opened twice.
  useEffect(() => {
    if (!requestedMessageId) return
    setSearchParams(
      (params) => {
        params.delete('message')
        return params
      },
      { replace: true },
    )
  }, [requestedMessageId, setSearchParams])

  // --- Searching this conversation (Search-InConversation) ---
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchToggleRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchBarId = `convo-search-${id}`
  const search = useConversationSearch(id!, isSearchOpen)

  const openSearch = () => {
    setIsSearchOpen(true)
    // Already open: back into the field, where the keys are.
    searchInputRef.current?.focus()
  }
  // From the info panel: the panel steps aside (on a phone it covers the
  // conversation) and the search bar opens.
  const searchFromPanel = () => {
    setIsInfoOpen(false)
    openSearch()
  }
  const closeSearch = () => {
    setIsSearchOpen(false)
    search.reset()
    searchToggleRef.current?.focus()
  }

  // Each match the search lands on is brought into view as a jump — without
  // taking focus, which stays in the search field. Adjusted during render,
  // like `?message=` above.
  const currentMatchId = search.current?.id ?? null
  const [shownMatchId, setShownMatchId] = useState<string | null>(null)
  if (currentMatchId !== shownMatchId) {
    setShownMatchId(currentMatchId)
    if (currentMatchId) jumpTo(currentMatchId, { focus: false })
  }

  // A window that couldn't be opened (the message is gone, outside the
  // history the viewer can see, or the request failed) goes back to the
  // newest messages, and a toast says why.
  if (anchor !== null && error && !isErrorOnHold && messages.length === 0) {
    setJumpFailure({ messageId: anchor, gone: isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0) })
    setAnchor(null)
    setJump(null)
  }

  useEffect(() => {
    if (!jumpFailure) return
    if (jumpFailure.gone) {
      toast.error('That message isn’t available. It may be outside the history you can see.', {
        id: 'jump-failed',
      })
    } else {
      toast.error(
        (t) => (
          <ActionToast
            title='Couldn’t open that message'
            body='Something went wrong. Try again.'
            actionLabel='Retry'
            onAction={() => {
              toast.dismiss(t.id)
              setJump((current) => ({ id: jumpFailure.messageId, seq: (current?.seq ?? 0) + 1 }))
              setAnchor(jumpFailure.messageId)
            }}
          />
        ),
        { id: 'jump-failed' },
      )
    }
  }, [jumpFailure])

  const headerTitle = isGroup
    ? conversation?.title || 'Untitled group'
    : conversation?.other_participant?.name || 'Direct conversation'

  if (isUnavailable) {
    // A moment while the server says why, rather than the wrong reason first.
    if (missing === 'checking') {
      return <section className='room room--unavailable' aria-label='Conversation' aria-busy='true' />
    }

    const notAMember = missing === 'not-a-member'

    return (
      <section className='room room--unavailable' aria-label={notAMember ? 'No access' : 'Conversation not found'}>
        <EmptyState
          icon={notAMember ? 'lock' : 'chatDots'}
          title={notAMember ? 'You’re not in this conversation' : 'This conversation isn’t available'}
          actions={
            <Link to='/conversations' className='btn secondary sm'>
              <Icon name='arrowLeft' size={14} />
              Back to chats
            </Link>
          }
        >
          {notAMember
            ? 'Only the people in it can open it. If it’s a group, ask one of them to add you.'
            : 'It may have been deleted, or the link is out of date.'}
        </EmptyState>
      </section>
    )
  }

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
          {/* Phone only (the list is beside the room from 768px). It counts
              what's waiting in the other conversations (Mobile-430-Chat-Group). */}
          <button
            type='button'
            className='room__back'
            aria-label={
              unreadElsewhere > 0 ? `Back to conversations, ${unreadElsewhere} unread` : 'Back to conversations'
            }
            onClick={() => navigate('/conversations')}
          >
            <Icon name='arrowLeft' />
            {unreadElsewhere > 0 && (
              <span className='unread-pill' aria-hidden='true'>
                {unreadElsewhere > 99 ? '99+' : unreadElsewhere}
              </span>
            )}
          </button>

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

          <Tooltip label='Search this conversation'>
            <Button
              ref={searchToggleRef}
              variant='ghost'
              icon
              aria-label='Search this conversation'
              aria-expanded={isSearchOpen}
              aria-controls={isSearchOpen ? searchBarId : undefined}
              onClick={() => (isSearchOpen ? closeSearch() : openSearch())}
            >
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

        {isSearchOpen && (
          <ConversationSearchBar id={searchBarId} search={search} onClose={closeSearch} inputRef={searchInputRef} />
        )}

        <ConnectionStrip />

        {/* Keyed by the window it shows: opening a window around a jump, or
            going back to the newest messages, starts its scroll position,
            divider and new-message count afresh. (Switching conversations
            remounts the whole room — see the wrapper at the bottom.) */}
        <Messages
          key={anchor ?? 'latest'}
          messages={messages}
          isLoading={isLoading || isErrorOnHold}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          error={error}
          onLoadOlder={loadOlder}
          onReply={startReply}
          onEdit={startEdit}
          readOnly={hasLeft}
          readState={hasJumped ? NOTHING_UNREAD : readState}
          isReady={areMessagesReady}
          isRefreshing={areMessagesRefreshing}
          isOlderError={isOlderError}
          onRetry={retry}
          greet={isGroup ? 'the group' : conversation?.other_participant?.name}
          onStartWriting={() => composerRef.current?.focus()}
          anchorId={anchor ?? undefined}
          jump={jump}
          onJumpTo={jumpTo}
          hasNewer={hasNewer}
          isLoadingNewer={isLoadingNewer}
          isNewerError={isNewerError}
          onLoadNewer={loadNewer}
          onJumpToLatest={jumpToLatest}
          searchTerms={search.terms}
          currentMatchId={isSearchOpen ? currentMatchId : null}
          readers={readers}
          readPointers={readPointers}
          isGroup={isGroup}
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
              // Sent from a jump's window, which stops short of the newest
              // messages: go there, where the message just sent now is.
              onSent={hasNewer ? jumpToLatest : undefined}
            />
          </div>
        )}

      </section>

      {isInfoOpen && conversation && user && (
        <InfoPanel id={infoPanelId} title={isGroup ? 'Group info' : 'Contact'} onClose={closeInfo}>
          {isGroup ? (
            <GroupInfoPanel conversation={conversation} currentUserId={user.id} readOnly={hasLeft} onSearch={searchFromPanel} />
          ) : (
            <ContactInfoPanel conversation={conversation} conversations={conversations} onSearch={searchFromPanel} />
          )}
        </InfoPanel>
      )}
    </div>
  )
}

const NOTHING_UNREAD = { unreadCount: 0, lastReadMessageId: null }

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
