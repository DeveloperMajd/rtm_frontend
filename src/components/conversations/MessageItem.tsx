import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import type { MessageType } from '../../utils/baseTypes'
import { updateMessage, deleteMessage } from '../../services/api/messages'
import useAuth from '../../hooks/useAuth'
import MessageReactions from './MessageReactions'

type MessageItemProps = {
  message: MessageType
  onReply: (message: MessageType) => void
}

const MessageItem = ({ message, onReply }: MessageItemProps) => {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState(message.body)

  const { mutate: saveEdit, isPending: isSaving } = useMutation({
    mutationFn: (body: string) => updateMessage(message.id, body),
    onSuccess: () => setIsEditing(false),
    onError: () => toast.error('Failed to update message. Please try again.'),
  })

  const { mutate: removeMessage, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteMessage(message.id),
    onError: () => toast.error('Failed to delete message. Please try again.'),
  })

  const isOwn = message.sender.id === user?.id
  const isDeleted = Boolean(message.deleted_at)

  return (
    <li className='message-item group flex flex-col border border-gray-300 rounded p-2 mb-2'>
      <strong className='sender-name'>{message.sender.name || 'Unknown Sender'}: </strong>

      {message.reply_to && (
        <div className='reply-preview border-l-2 border-gray-300 pl-2 mb-1 text-xs text-gray-500 italic'>
          {message.reply_to.deleted_at
            ? 'Original message deleted'
            : `${message.reply_to.sender.name}: ${message.reply_to.body}`}
        </div>
      )}

      {isDeleted ? (
        <div className='message-body italic text-gray-400'>This message was deleted</div>
      ) : isEditing ? (
        <div className='flex flex-col gap-1'>
          <textarea
            className='border border-gray-300 rounded p-1 text-sm'
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={2}
          />
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={() => saveEdit(editBody)}
              disabled={isSaving || !editBody.trim()}
              className='text-xs text-blue-600 hover:underline disabled:opacity-50'
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type='button'
              onClick={() => {
                setIsEditing(false)
                setEditBody(message.body)
              }}
              className='text-xs text-gray-500 hover:underline'
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className='message-body whitespace-pre-wrap'>{message.body}</div>
      )}

      {!isDeleted && <MessageReactions messageId={message.id} reactions={message.reactions} />}

      <div className='flex items-center justify-between mt-1'>
        <div className='message-actions flex gap-2 opacity-0 group-hover:opacity-100 text-xs'>
          {!isDeleted && (
            <button
              type='button'
              onClick={() => onReply(message)}
              className='text-gray-400 hover:text-gray-600'
            >
              Reply
            </button>
          )}
          {isOwn && !isDeleted && !isEditing && (
            <>
              <button
                type='button'
                onClick={() => setIsEditing(true)}
                className='text-gray-400 hover:text-gray-600'
              >
                Edit
              </button>
              <button
                type='button'
                onClick={() => removeMessage()}
                disabled={isDeleting}
                className='text-gray-400 hover:text-red-600 disabled:opacity-50'
              >
                Delete
              </button>
            </>
          )}
        </div>

        {message.created_at && (
          <time
            dateTime={message.created_at}
            className='timestamp text-right text-sm text-gray-500 ml-2'
          >
            {formatDistanceToNow(new Date(message.created_at), { includeSeconds: true }) + ' ago'}
            {message.edited_at && !isDeleted ? ' (edited)' : ''}
          </time>
        )}
      </div>
    </li>
  )
}

export default MessageItem
