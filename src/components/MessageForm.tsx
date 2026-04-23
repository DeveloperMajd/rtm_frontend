import { useState } from 'react'
import { sendMessage } from '../services/api/messages'

type MessageFormProps = {
  conversationId: number
  onMessageSent: () => void
}

const MessageForm = ({ conversationId, onMessageSent }: MessageFormProps) => {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (!message.trim() || isSending) return

    try {
      setIsSending(true)
      setError(null)
      await sendMessage(conversationId, 1, message) // Assuming sender_user_id is 1 for now
      setMessage('')
      onMessageSent()
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form
      className='message-form'
      onSubmit={handleSubmit}
    >
      <input
        type='text'
        id='message-input'
        placeholder='Type your message...'
        className='message-input'
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        type='submit'
        className='send-button'
        disabled={isSending}
      >
        {isSending ? 'Sending...' : 'Send'}
      </button>
      {error && <p className='error-msg'>{error}</p>}
    </form>
  )
}

export default MessageForm
