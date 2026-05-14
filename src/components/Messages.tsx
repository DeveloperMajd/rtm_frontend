import { useEffect, useRef } from 'react'
import type { MessageType } from '../utils/baseTypes'
import Spinner from './UI/loaders/Spinner'
import { formatDistanceToNow } from 'date-fns'

type MessagesProps = {
  messages: MessageType[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: Error | null
  onLoadOlder: () => void
}

const Messages = ({ messages, isLoading, isLoadingMore, hasMore, error, onLoadOlder }: MessagesProps) => {
  const listRef = useRef<HTMLUListElement>(null)
  const lastMessageIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (messages.length === 0) return
    const lastMessageId = messages[messages.length - 1].id
    if (lastMessageId !== lastMessageIdRef.current) {
      listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' })
    }
    lastMessageIdRef.current = lastMessageId
  }, [messages])

  return (
    <div className='messages-container w-full md:w-2/3 p-4 overflow-y-auto'>
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
        {messages &&
          messages.length > 0 &&
          messages.map((message) => (
            <li
              key={message.id}
              className='message-item border border-gray-300 rounded p-2 mb-2'
            >
              <strong>{message.sender.name || 'Unknown Sender'}: </strong>
              <div>{message.body}</div>
              {message.created_at && (
                <time
                  dateTime={message.created_at}
                  className='text-sm text-gray-500 ml-2'
                >
                  {formatDistanceToNow(new Date(message.created_at), {
                    includeSeconds: true,
                  }) + ' ago'}
                </time>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}

export default Messages
