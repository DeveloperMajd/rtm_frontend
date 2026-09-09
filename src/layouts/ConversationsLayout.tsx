import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Conversations from '../components/conversations/Conversations'
import Contacts from '../components/conversations/Contacts'
import GroupModal from '../components/conversations/GroupModal'
import MessageSearch from '../components/conversations/MessageSearch'
import Button from '../components/ui/Button'
import useConversations from '../hooks/useConversations'
import useAuth from '../hooks/useAuth'
import usePresenceHeartbeat from '../hooks/usePresenceHeartbeat'

type Tab = 'chats' | 'contacts'

function ConversationsLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const { conversations, isLoading, error } = useConversations()
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  usePresenceHeartbeat(true)

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

        <MessageSearch />

        <div className='flex items-center gap-1 px-4 pt-3'>
          <button
            type='button'
            onClick={() => setActiveTab('chats')}
            className={`flex-1 text-sm font-medium py-2 rounded cursor-pointer ${
              activeTab === 'chats' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Chats
          </button>
          <button
            type='button'
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 text-sm font-medium py-2 rounded cursor-pointer ${
              activeTab === 'contacts' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Contacts
          </button>
        </div>

        {activeTab === 'chats' ? (
          <Conversations
            conversations={conversations}
            isLoading={isLoading}
            error={error}
          />
        ) : (
          <Contacts onConversationOpened={() => setActiveTab('chats')} />
        )}

        <Button
          variant='primary'
          label='New Group'
          onClick={() => setIsGroupModalOpen(true)}
        />
      </div>

      <Outlet />

      {isGroupModalOpen && (
        <GroupModal onClose={() => setIsGroupModalOpen(false)} />
      )}
    </section>
  )
}

export default ConversationsLayout
