import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sendMessage } from '../../services/api/messages'
import { postTyping } from '../../services/api/conversations'
import type { MessageType } from '../../utils/baseTypes'

type MessageFormProps = {
  conversationId: string
  replyingTo: MessageType | null
  onCancelReply: () => void
}

const TYPING_THROTTLE_MS = 2000

const MessageForm = ({ conversationId, replyingTo, onCancelReply }: MessageFormProps) => {
  const [body, setBody] = useState('')
  const queryClient = useQueryClient()
  const typingThrottle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (text: string) => sendMessage(conversationId, text, replyingTo?.id),
    onSuccess: () => {
      setBody('')
      onCancelReply()
      void queryClient.invalidateQueries({
        queryKey: ['messages', conversationId],
      })
    },
    onError: () => toast.error('Failed to send message. Please try again.'),
  })

  const submit = () => {
    if (!body.trim() || isPending) return
    mutate(body)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!body.trim() || isPending) return
      mutate(body)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)

    if (!typingThrottle.current) {
      void postTyping(conversationId)
      typingThrottle.current = setTimeout(() => {
        typingThrottle.current = null
      }, TYPING_THROTTLE_MS)
    }
  }

  return (
    <form
      className='message-form flex flex-col gap-1 my-4'
      onSubmit={(e) => { e.preventDefault(); submit() }}
    >
      {replyingTo && (
        <div className='reply-chip flex items-center justify-between border-l-2 border-blue-400 bg-blue-50 rounded px-2 py-1 text-xs text-gray-600'>
          <span className='truncate'>
            Replying to <strong>{replyingTo.sender.name}</strong>: {replyingTo.body}
          </span>
          <button
            type='button'
            onClick={onCancelReply}
            className='text-gray-400 hover:text-gray-600 ml-2'
          >
            &times;
          </button>
        </div>
      )}
      <div className='flex justify-between items-center'>
        <textarea
          id='message-input'
          placeholder='Type your message...'
          className='message-input w-100'
          rows={1}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <button
          type='submit'
          className='send-button'
          disabled={isPending}
        >
          {isPending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  )
}

export default MessageForm
