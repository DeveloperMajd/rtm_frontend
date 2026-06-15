import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './ConversationsLayout.scss'
import Conversations from '../components/conversations/Conversations'
import ConversationModal from '../components/conversations/ConversationModal'
import Button from '../components/ui/Button'
import useConversations from '../hooks/useConversations'
import useAuth from '../hooks/useAuth'

function ConversationsLayout() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { conversations, isLoading, error } = useConversations()
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <section className='app-container flex flex-col md:flex-row h-screen gap-12'>
      <Toaster position='top-right' />
      <div className='flex flex-col h-full'>
        <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200'>
          <span className='text-sm font-medium text-gray-700 truncate'>{user?.name}</span>
          <Button variant='secondary' label='Logout' onClick={() => void handleLogout()} />
        </div>
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
