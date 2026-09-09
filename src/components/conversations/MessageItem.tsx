import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import type { MessageType } from '../../utils/baseTypes'
import { updateMessage, deleteMessage } from '../../services/api/messages'
import useAuth from '../../hooks/useAuth'
import Avatar from '../ui/Avatar'
import MessageReactions from './MessageReactions'
import MessageAttachment from './MessageAttachment'

type MessageItemProps = {
  message: MessageType
  onReply: (message: MessageType) => void
  grouped?: boolean
  readOnly?: boolean
}

const MessageItem = ({ message, onReply, grouped = false, readOnly = false }: MessageItemProps) => {
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

  const isOwn = message.sender?.id === user?.id
  const isDeleted = Boolean(message.deleted_at)
  const showMeta = !grouped

  return (
    <li className={`msg-row ${isOwn ? 'is-own' : 'is-other'}${grouped ? ' is-grouped' : ''}`}>
      <div className='msg-row__avatar-slot'>
        {!isOwn && !grouped && (
          <Avatar name={message.sender?.name ?? '?'} src={message.sender?.avatar_url} size='xs' />
        )}
      </div>

      <div className={`bubble${isDeleted ? ' is-deleted' : ''}`}>
        {!isOwn && !grouped && (
          <span className='bubble__sender'>{message.sender?.name ?? 'Unknown'}</span>
        )}

        {message.reply_to && (
          <span className='bubble__reply'>
            {message.reply_to.deleted_at
              ? 'Original message deleted'
              : `${message.reply_to.sender?.name ?? 'Unknown'}: ${message.reply_to.body}`}
          </span>
        )}

        {isDeleted ? (
          <span>This message was deleted</span>
        ) : isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <textarea
              className='textarea'
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={2}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type='button'
                className='btn primary'
                onClick={() => saveEdit(editBody)}
                disabled={isSaving || !editBody.trim()}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type='button'
                className='btn ghost'
                onClick={() => {
                  setIsEditing(false)
                  setEditBody(message.body)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          message.body && <span>{message.body}</span>
        )}

        {!isDeleted && message.attachments && message.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {message.attachments.map((attachment) => (
              <MessageAttachment key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}

        {!isDeleted && <MessageReactions messageId={message.id} reactions={message.reactions} />}

        {showMeta && (
          <span className='bubble__meta'>
            <time dateTime={message.created_at}>{format(new Date(message.created_at), 'HH:mm')}</time>
            {message.edited_at && !isDeleted ? ' · edited' : ''}
          </span>
        )}

        {!readOnly && !isDeleted && !isEditing && (
          <div className='bubble__actions'>
            <button type='button' onClick={() => onReply(message)} aria-label='Reply'>
              ↩
            </button>
            {isOwn && (
              <>
                <button type='button' onClick={() => setIsEditing(true)} aria-label='Edit'>
                  ✎
                </button>
                <button
                  type='button'
                  onClick={() => removeMessage()}
                  disabled={isDeleting}
                  aria-label='Delete'
                >
                  🗑
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export default MessageItem
