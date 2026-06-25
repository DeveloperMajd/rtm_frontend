import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sendMessage } from '../../services/api/messages'
import { postTyping } from '../../services/api/conversations'

type MessageFormProps = {
  conversationId: string
}

const TYPING_THROTTLE_MS = 2000

const MessageForm = ({ conversationId }: MessageFormProps) => {
  const [body, setBody] = useState('')
  const queryClient = useQueryClient()
  const typingThrottle = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: (text: string) => sendMessage(conversationId, text),
    onSuccess: () => {
      setBody('')
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
      className='message-form flex justify-between items-center my-4'
      onSubmit={(e) => { e.preventDefault(); submit() }}
    >
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
    </form>
  )
}

export default MessageForm
