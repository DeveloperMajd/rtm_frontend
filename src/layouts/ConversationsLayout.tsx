import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './ConversationsLayout.scss'
import Conversations from '../components/conversations/Conversations'
import ConversationModal from '../components/conversations/ConversationModal'
import Button from '../components/ui/Button'
import useConversations from '../hooks/useConversations'

function ConversationsLayout() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { conversations, isLoading, error } = useConversations()

  return (
    <section className='app-container flex flex-col md:flex-row h-screen gap-12'>
      <Toaster position='top-right' />
      <div>
        <Conversations
          conversations={conversations}
          isLoading={isLoading}
          error={error}
        />
        <Button
          variant='primary'
          label='New Conversation'
          onClick={() => setIsModalOpen(true)}
        />
      </div>

      <Outlet />

      {isModalOpen && (
        <ConversationModal onClose={() => setIsModalOpen(false)} />
      )}
    </section>
  )
}

export default ConversationsLayout
