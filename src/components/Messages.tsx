import type { MessageType } from '../utils/baseTypes'
import { formatDate } from '../utils/date-formatter'
import Spinner from './UI/loaders/Spinner'

type MessagesProps = {
  messages: MessageType[]
  isLoading: boolean
  error: Error | null
}

const Messages = ({ messages, isLoading, error }: MessagesProps) => {

  return (
    <div className='messages-container w-full md:w-2/3 p-4 overflow-y-auto'>
      {isLoading && (
        <Spinner
          position='left'
          size={40}
          color='#6E026F'
        />
      )}
      {error && <p className='error-msg'>Error: {error.message}</p>}
      <ul className='flex flex-col justify-center '>
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
              {message.body}
              {message.created_at && (
                <span className='text-sm text-gray-500 ml-2'>
                  {formatDate(message.created_at, 'MMMM dd, HH:mm')}
                </span>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}

export default Messages
