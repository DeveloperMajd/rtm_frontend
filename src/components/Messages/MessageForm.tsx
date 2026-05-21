import { useState } from 'react'
import toast from 'react-hot-toast'
import { sendMessage } from '../../services/api/messages'

type MessageFormProps = {
  conversationId: number
  onMessageSent: () => void
}

const MessageForm = ({ conversationId, onMessageSent }: MessageFormProps) => {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const send = async () => {
    if (!message.trim() || isSending) return
    try {
      setIsSending(true)
      await sendMessage(conversationId, 1, message)
      setMessage('')
      onMessageSent()
    } catch {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault()
    void send()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <form
      className='message-form flex justify-between items-center my-4'
      onSubmit={handleSubmit}
    >
      <textarea
        id='message-input'
        placeholder='Type your message...'
        className='message-input w-100'
        rows={1}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type='submit'
        className='send-button'
        disabled={isSending}
      >
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}

export default MessageForm
