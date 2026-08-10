import { useEffect, useRef } from 'react'
import type { MessageType } from '../../utils/baseTypes'
import Spinner from '../ui/Spinner'
import MessageItem from './MessageItem'
import './Messages.scss'

type MessagesProps = {
  messages: MessageType[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: Error | null
  onLoadOlder: () => void
  onReply: (message: MessageType) => void
}

const Messages = ({
  messages,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadOlder,
  onReply,
}: MessagesProps) => {
  const listRef = useRef<HTMLUListElement>(null)
  const lastMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (messages.length === 0) return
    const lastMessageId = messages[messages.length - 1].id
    if (lastMessageId !== lastMessageIdRef.current) {
      listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'instant' })
    }
    lastMessageIdRef.current = lastMessageId
  }, [messages])

  return (
    <div className='messages-container'>
      {isLoading && (
        <Spinner
          position='left'
          size={40}
          color='#6E026F'
        />
      )}
      {!isLoading && hasMore && (
        <div className='flex justify-center mb-2'>
          <button
            onClick={onLoadOlder}
            disabled={isLoadingMore}
            className='text-sm text-blue-500 hover:underline disabled:opacity-50'
          >
            {isLoadingMore ? 'Loading...' : 'Load older messages'}
          </button>
        </div>
      )}
      {error && <p className='error-msg'>Error: {error.message}</p>}
      <ul
        ref={listRef}
        className='messages-list flex flex-col justify-center'
      >
        {!isLoading && !error && messages.length === 0 && (
          <li className='text-sm text-gray-500'>No messages found.</li>
        )}
        {messages.length > 0 &&
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onReply={onReply}
            />
          ))}
      </ul>
    </div>
  )
}

export default Messages
