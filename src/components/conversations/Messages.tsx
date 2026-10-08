import { Fragment, useRef, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import type { MessageType } from '../../utils/baseTypes'
import { systemMessageText } from '../../utils/systemMessageText'
import { resolveUnreadBoundary } from '../../utils/unreadDivider'
import { receiptFor, type Reader } from '../../utils/readReceipts'
import type { ReadPointer } from '../../services/api/conversations'
import type { ReadStateSnapshot } from '../../hooks/useReadStateSnapshot'
import useAuth from '../../hooks/useAuth'
import { useAutoLoadOlder } from '../../hooks/useAutoLoadOlder'
import { useAutoLoadNewer } from '../../hooks/useAutoLoadNewer'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import { useJumpHighlight, type JumpTarget } from '../../hooks/useJumpHighlight'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import Spinner from '../ui/Spinner'
import Icon from '../ui/Icon'
import { MessagesSkeleton } from '../ui/Skeleton'
import MessageItem from './MessageItem'
import SystemMessage from './SystemMessage'

type MessagesProps = {
  messages: MessageType[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: Error | null
  onLoadOlder: () => void
  onReply: (message: MessageType) => void
  /** Starts editing one of the viewer's own messages in the composer. */
  onEdit?: (message: MessageType) => void
  readOnly?: boolean
  /** The viewer's read state as of opening this conversation (see
   * useReadStateSnapshot) — undefined while it's still being determined. */
  readState?: ReadStateSnapshot
  /** True once `messages` reflects a fetch made by this mount, rather than
   * whatever a previous visit left cached (see useMessages). */
  isReady?: boolean
  /** A whole-query refetch is in flight — paging older must hold off (see
   * useMessages's isRefreshing). */
  isRefreshing?: boolean
  /** Paging in older history failed (the rest is still good). */
  isOlderError?: boolean
  /** Fetches the conversation again after it failed to open. */
  onRetry?: () => void
  /** Who a first message would greet — "Kal", or "the group". */
  greet?: string
  /** Puts the caret in the composer, from the empty conversation. */
  onStartWriting?: () => void
  /**
   * The list is a window opened around this message (a jump to something
   * that wasn't loaded — see useMessages's anchor): it opens centred on it,
   * with no unread divider, instead of at the newest message.
   */
  anchorId?: string
  /** A message to bring into view and highlight (see useJumpHighlight). */
  jump?: JumpTarget | null
  /** Follows a reply's quote to the message it quotes. */
  onJumpTo?: (messageId: string) => void
  /** The window stops short of the newest message (see useMessages). */
  hasNewer?: boolean
  isLoadingNewer?: boolean
  /** Reading newer history failed (what's loaded is still good). */
  isNewerError?: boolean
  onLoadNewer?: () => void
  /** Leaves a jump's window for the newest messages. */
  onJumpToLatest?: () => void
  /** Words being searched for in this conversation, marked where they
   * appear (see useConversationSearch). */
  searchTerms?: string[]
  /** The search match being shown, which keeps a ring while it is. */
  currentMatchId?: string | null
  /** Everyone else still in the conversation, and how far each has read —
   * the read state on the viewer's newest message (see receiptFor). */
  readers?: Reader[]
  readPointers?: ReadPointer[]
  isGroup?: boolean
  /** The messages the viewer has saved, so each one's menu offers Save or
   * Remove from saved (see useSavedMessageIds). */
  savedIds?: ReadonlySet<string>
}

const NONE_SAVED: ReadonlySet<string> = new Set()

const GROUP_WINDOW_MS = 5 * 60 * 1000

const noop = () => {}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, d MMM yyyy')
}

const Messages = ({
  messages,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadOlder,
  onReply,
  onEdit = noop,
  readOnly = false,
  readState,
  isReady = true,
  isRefreshing = false,
  isOlderError = false,
  onRetry,
  greet,
  onStartWriting,
  anchorId,
  jump,
  onJumpTo,
  hasNewer = false,
  isLoadingNewer = false,
  isNewerError = false,
  onLoadNewer = noop,
  onJumpToLatest = noop,
  searchTerms,
  currentMatchId = null,
  readers = [],
  readPointers = [],
  isGroup = false,
  savedIds = NONE_SAVED,
}: MessagesProps) => {
  const { user } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const unreadDividerRef = useRef<HTMLLIElement>(null)

  const lastMessage = messages[messages.length - 1] as MessageType | undefined

  // Read state is shown once, on the viewer's newest message that's still
  // there (Study-Read-State) — not repeated down every bubble.
  const lastOwnMessageId = messages.findLast(
    (m) => m.type !== 'system' && !m.deleted_at && m.sender?.id === user?.id,
  )?.id
  const receipt = lastOwnMessageId ? receiptFor(lastOwnMessageId, readers, readPointers, isGroup) : undefined

  // The unread divider's position is resolved once per conversation (the
  // whole room is remounted per conversation — see ConversationRoom) and
  // then frozen: later messages arriving must not shift it, since it marks
  // where reading was left off. State, not a ref: a ref read/written during
  // render isn't guaranteed to survive a discarded speculative render pass.
  //
  // resolveUnreadBoundary anchors on the server's own read pointer, so this
  // only has to decide *when* there's enough history loaded to trust the
  // answer — and to keep paging (via forceLoad below) while there isn't.
  //
  // `isReady` gates the whole thing: until this mount has fetched its own
  // messages, `messages` is whatever a previous visit left in the cache,
  // and anything that arrived in between is missing from the end of it.
  // Resolving against that window puts the boundary in the wrong place and
  // then freezes it there, so every message still in flight piles up below
  // a divider that undercounts them.
  //
  // A window opened around a jump has no divider: it isn't where reading
  // was left off, and paging back through it to find out would be a detour
  // from the message the viewer asked for.
  const isAnchored = anchorId !== undefined
  const [unreadBoundaryId, setUnreadBoundaryId] = useState<string | null | undefined>(
    isAnchored ? null : undefined,
  )
  let needsMoreForBoundary = false
  if (isReady && unreadBoundaryId === undefined && readState !== undefined) {
    const resolution = resolveUnreadBoundary(
      messages,
      readState.lastReadMessageId,
      readState.unreadCount,
      user?.id,
      hasMore,
    )
    needsMoreForBoundary = resolution.needsMore
    if (resolution.boundaryId !== undefined) {
      setUnreadBoundaryId(resolution.boundaryId)
    }
  }

  useAutoLoadOlder({
    containerRef,
    // After a failed page it waits for Retry, rather than trying again on
    // every scroll. And not before the conversation has been scrolled to
    // where it opens: until then the list sits at the top, which looked
    // like the viewer reaching for older history — the page that loaded
    // then put the view back up there, undoing the scroll to the bottom.
    // Paging to find the unread divider (forceLoad) is the exception. (A
    // jump's window is placed in the same commit its messages first render,
    // before this looks at the scroll position.)
    hasMore: hasMore && !isOlderError && (unreadBoundaryId !== undefined || needsMoreForBoundary),
    isLoadingMore,
    isRefreshing,
    onLoadOlder,
    oldestMessageId: messages[0]?.id,
    forceLoad: needsMoreForBoundary,
  })

  useAutoLoadNewer({
    containerRef,
    hasNewer: hasNewer && !isNewerError,
    isLoadingNewer,
    isRefreshing,
    onLoadNewer,
  })

  const { newCount, scrollToBottom } = useStickToBottom({
    containerRef,
    lastMessageId: lastMessage?.id,
    isOwnLastMessage: lastMessage?.sender?.id === user?.id,
    unreadBoundaryId,
    unreadDividerRef,
    openAtId: anchorId,
    detached: hasNewer,
  })

  useJumpHighlight({
    containerRef,
    jump,
    isTargetLoaded: jump ? messages.some((m) => m.id === jump.id) : false,
  })

  // Announce new incoming messages for screen readers. This runs during
  // render rather than in an effect — React's documented "adjust state when
  // a prop changes" pattern: comparing against a stored previous id and
  // calling setState right here lets React re-render with the new
  // announcement before paint, instead of committing once, then again.
  const [announcedId, setAnnouncedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // A jump's window gains new last messages by reading newer history in,
  // not by messages arriving — tracked as in useStickToBottom.
  const [announcedWhileDetached, setAnnouncedWhileDetached] = useState(hasNewer)
  if (messages.length > 0) {
    const last = messages[messages.length - 1]
    if (last.id !== announcedId) {
      setAnnouncedId(last.id)
      // Skip the very first render (nothing to compare against yet), pages
      // of history, and messages the viewer just sent themselves — the
      // composer already gives them feedback.
      if (announcedId !== null && !announcedWhileDetached) {
        if (last.type === 'system') {
          setAnnouncement(systemMessageText(last, user?.id))
        } else if (last.sender?.id !== user?.id) {
          setAnnouncement(`${last.sender?.name ?? 'Someone'}: ${last.body || 'sent an attachment'}`)
        }
      }
    }
  }
  if (announcedWhileDetached !== hasNewer) {
    setAnnouncedWhileDetached(hasNewer)
  }

  // The container div is always rendered — never swapped out for a bare
  // <Spinner> — so containerRef.current is never null by the time the
  // scroll-tracking effects in useAutoLoadOlder/useStickToBottom run.
  // Those effects depend on the stable ref *object*, not `.current`, so
  // if the ref started out null on a conditionally-absent element, they'd
  // never get a second chance to attach once a real element appeared.
  return (
    <div className='room__stage'>
      <div ref={containerRef} className='room__scroll scroll-y'>
      {/* Always here, so the first message into an empty conversation is
          announced too — a region that appears already holding text isn't. */}
      <div aria-live='polite' className='sr-only'>
        {announcement}
      </div>

      {isLoading && messages.length === 0 ? (
        <>
          <p className='sr-only' role='status'>
            Loading messages…
          </p>
          <MessagesSkeleton />
        </>
      ) : error && messages.length === 0 ? (
        // States-Errors "Conversation failed".
        <EmptyState
          icon='alert'
          tone='danger'
          title='Couldn’t open this conversation'
          className='room__state'
          actions={
            <>
              {onRetry && (
                <Button variant='secondary' className='sm' onClick={onRetry}>
                  <Icon name='refresh' size={14} />
                  Try again
                </Button>
              )}
              <Link to='/conversations' className='btn tertiary sm'>
                Back to chats
              </Link>
            </>
          }
        >
          Something went wrong on our side. Try again in a moment.
        </EmptyState>
      ) : messages.length === 0 ? (
        // States-Empty "Empty conversation".
        <EmptyState
          icon='chat'
          title='No messages yet'
          className='room__state'
          actions={
            !readOnly &&
            onStartWriting && (
              <Button variant='secondary' className='sm' onClick={onStartWriting}>
                <Icon name='pencil' size={14} />
                Write a message
              </Button>
            )
          }
        >
          {readOnly ? 'Nothing was said here.' : `Say hello to ${greet ?? 'them'}. Your first message starts the conversation.`}
        </EmptyState>
      ) : (
        <>
          {isLoadingMore && (
            <div className='message-list__loading-older'>
              <Spinner size={22} />
            </div>
          )}

          {/* States-Errors "Older history failed": what's loaded stays. */}
          {isOlderError && !isLoadingMore && (
            <div className='message-list__older-failed' role='alert'>
              <Icon name='alertCircle' size={14} />
              Couldn’t load earlier messages.
              <button type='button' onClick={onLoadOlder}>
                Retry
              </button>
            </div>
          )}

          <ul className='message-list'>

            {messages.map((message, i) => {
              const prev = messages[i - 1]
              const showDay =
                !prev || format(new Date(prev.created_at), 'yyyy-MM-dd') !==
                  format(new Date(message.created_at), 'yyyy-MM-dd')
              const showUnread = message.id === unreadBoundaryId

              const content =
                message.type === 'system' ? (
                  <SystemMessage key={message.id} message={message} />
                ) : (
                  <MessageItem
                    key={message.id}
                    message={message}
                    onReply={onReply}
                    onEdit={onEdit}
                    onJumpTo={onJumpTo}
                    highlightTerms={searchTerms}
                    isCurrentMatch={message.id === currentMatchId}
                    isSaved={savedIds.has(message.id)}
                    receipt={message.id === lastOwnMessageId ? receipt : undefined}
                    grouped={
                      !showDay &&
                      !showUnread &&
                      prev?.type !== 'system' &&
                      prev?.sender?.id === message.sender?.id &&
                      new Date(message.created_at).getTime() - new Date(prev.created_at).getTime() <
                        GROUP_WINDOW_MS
                    }
                    readOnly={readOnly}
                  />
                )

              return (
                <Fragment key={message.id}>
                  {showDay && (
                    <li className='msg-day'>
                      <span>{dayLabel(message.created_at)}</span>
                    </li>
                  )}
                  {showUnread && (
                    <li ref={unreadDividerRef} className='msg-divider msg-divider--unread'>
                      <span className='msg-divider__label'>New</span>
                      <span className='msg-divider__count'>{readState?.unreadCount}</span>
                    </li>
                  )}
                  {content}
                </Fragment>
              )
            })}
          </ul>

          {isLoadingNewer && (
            <div className='message-list__loading-newer'>
              <Spinner size={22} />
            </div>
          )}

          {isNewerError && !isLoadingNewer && (
            <div className='message-list__older-failed message-list__newer-failed' role='alert'>
              <Icon name='alertCircle' size={14} />
              Couldn’t load newer messages.
              <button type='button' onClick={onLoadNewer}>
                Retry
              </button>
            </div>
          )}
        </>
      )}
      </div>

      {/* The loading skeleton, over the messages until they've been scrolled
          to where the conversation opens (see useStickToBottom) — so they
          appear in place, not at the top and then jumping. */}
      {messages.length > 0 && (
        <div className='msg-cover' aria-hidden='true'>
          <MessagesSkeleton />
        </div>
      )}

      {/* Outside the scroll container on purpose. An absolutely positioned
          child of a scrolling element is anchored to that element's
          unscrolled origin and travels with the content, so this used to be
          visible only when scrolled to the very top — appearing at random
          while reading back through history, and missing at the moment it
          was needed. Anchoring it to the non-scrolling stage instead keeps
          it over the viewport where it belongs. */}
      {/* A jump's window stops short of the newest message; the way back
          there is a fresh read of it, not a scroll. */}
      {hasNewer && messages.length > 0 ? (
        <button type='button' className='new-messages-pill' onClick={onJumpToLatest}>
          Jump to latest
          <Icon name='arrowDown' size={14} />
        </button>
      ) : newCount > 0 && (
        <button type='button' className='new-messages-pill' onClick={scrollToBottom}>
          {newCount} new message{newCount === 1 ? '' : 's'}
          <Icon name='arrowDown' size={14} />
        </button>
      )}
    </div>
  )
}

export default Messages
