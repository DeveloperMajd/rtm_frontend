import { Fragment, useRef, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import type { MessageType } from '../../utils/baseTypes'
import { systemMessageText } from '../../utils/systemMessageText'
import { resolveUnreadBoundary } from '../../utils/unreadDivider'
import type { ReadStateSnapshot } from '../../hooks/useReadStateSnapshot'
import useAuth from '../../hooks/useAuth'
import { useAutoLoadOlder } from '../../hooks/useAutoLoadOlder'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import Spinner from '../ui/Spinner'
import Icon from '../ui/Icon'
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
}

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
}: MessagesProps) => {
  const { user } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const unreadDividerRef = useRef<HTMLLIElement>(null)

  const lastMessage = messages[messages.length - 1] as MessageType | undefined

  // Delivery state is shown once, on the viewer's newest message that's
  // still there (Study-Read-State) — not repeated down every bubble.
  const lastOwnMessageId = messages.findLast(
    (m) => m.type !== 'system' && !m.deleted_at && m.sender?.id === user?.id,
  )?.id

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
  const [unreadBoundaryId, setUnreadBoundaryId] = useState<string | null | undefined>(undefined)
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
    hasMore,
    isLoadingMore,
    isRefreshing,
    onLoadOlder,
    oldestMessageId: messages[0]?.id,
    forceLoad: needsMoreForBoundary,
  })

  const { newCount, scrollToBottom } = useStickToBottom({
    containerRef,
    lastMessageId: lastMessage?.id,
    isOwnLastMessage: lastMessage?.sender?.id === user?.id,
    unreadBoundaryId,
    unreadDividerRef,
  })

  // Announce new incoming messages for screen readers. This runs during
  // render rather than in an effect — React's documented "adjust state when
  // a prop changes" pattern: comparing against a stored previous id and
  // calling setState right here lets React re-render with the new
  // announcement before paint, instead of committing once, then again.
  const [announcedId, setAnnouncedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (messages.length > 0) {
    const last = messages[messages.length - 1]
    if (last.id !== announcedId) {
      setAnnouncedId(last.id)
      // Skip the very first render (nothing to compare against yet) and
      // messages the viewer just sent themselves — the composer already
      // gives them feedback.
      if (announcedId !== null) {
        if (last.type === 'system') {
          setAnnouncement(systemMessageText(last, user?.id))
        } else if (last.sender?.id !== user?.id) {
          setAnnouncement(`${last.sender?.name ?? 'Someone'}: ${last.body || 'sent an attachment'}`)
        }
      }
    }
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
      {isLoading && messages.length === 0 ? (
        <Spinner block />
      ) : (
        <>
          <div aria-live='polite' className='sr-only'>
            {announcement}
          </div>

          {isLoadingMore && (
            <div className='message-list__loading-older'>
              <Spinner size={22} />
            </div>
          )}

          {error && <p className='empty-state'>Error: {error.message}</p>}

          <ul className='message-list'>
            {!error && messages.length === 0 && (
              <li className='empty-state'>No messages yet — say hello 👋</li>
            )}

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
                    showReadState={message.id === lastOwnMessageId}
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
        </>
      )}
      </div>

      {/* Outside the scroll container on purpose. An absolutely positioned
          child of a scrolling element is anchored to that element's
          unscrolled origin and travels with the content, so this used to be
          visible only when scrolled to the very top — appearing at random
          while reading back through history, and missing at the moment it
          was needed. Anchoring it to the non-scrolling stage instead keeps
          it over the viewport where it belongs. */}
      {newCount > 0 && (
        <button type='button' className='new-messages-pill' onClick={scrollToBottom}>
          {newCount} new message{newCount === 1 ? '' : 's'}
          <Icon name='arrowDown' size={14} />
        </button>
      )}
    </div>
  )
}

export default Messages
