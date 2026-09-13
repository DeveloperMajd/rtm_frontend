import { Fragment, useEffect, useRef, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import type { MessageType } from '../../utils/baseTypes'
import { systemMessageText } from '../../utils/systemMessageText'
import useAuth from '../../hooks/useAuth'
import Spinner from '../ui/Spinner'
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
  readOnly?: boolean
}

const GROUP_WINDOW_MS = 5 * 60 * 1000

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
  readOnly = false,
}: MessagesProps) => {
  const { user } = useAuth()
  const listRef = useRef<HTMLUListElement>(null)
  const lastIdRef = useRef<string | null>(null)

  // Scroll to the newest message on arrival — a ref-based comparison, so
  // there's no setState here and this stays a plain DOM-syncing effect.
  useEffect(() => {
    if (messages.length === 0) return
    const lastId = messages[messages.length - 1].id
    if (lastId !== lastIdRef.current) {
      listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'instant' })
    }
    lastIdRef.current = lastId
  }, [messages])

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

  if (isLoading && messages.length === 0) {
    return <Spinner block />
  }

  return (
    <>
      <div aria-live='polite' className='sr-only'>
        {announcement}
      </div>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <button
            type='button'
            className='btn ghost'
            onClick={onLoadOlder}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading…' : 'Load older messages'}
          </button>
        </div>
      )}

      {error && <p className='empty-state'>Error: {error.message}</p>}

      <ul ref={listRef} className='message-list'>
        {!error && messages.length === 0 && (
          <li className='empty-state'>No messages yet — say hello 👋</li>
        )}

        {messages.map((message, i) => {
          if (message.type === 'system') {
            return <SystemMessage key={message.id} message={message} />
          }

          const prev = messages[i - 1]
          const showDay =
            !prev || format(new Date(prev.created_at), 'yyyy-MM-dd') !==
              format(new Date(message.created_at), 'yyyy-MM-dd')

          const grouped =
            !showDay &&
            prev?.type !== 'system' &&
            prev?.sender?.id === message.sender?.id &&
            new Date(message.created_at).getTime() - new Date(prev.created_at).getTime() <
              GROUP_WINDOW_MS

          return (
            <Fragment key={message.id}>
              {showDay && (
                <li className='msg-day'>
                  <span>{dayLabel(message.created_at)}</span>
                </li>
              )}
              <MessageItem
                message={message}
                onReply={onReply}
                grouped={grouped}
                readOnly={readOnly}
              />
            </Fragment>
          )
        })}
      </ul>
    </>
  )
}

export default Messages
