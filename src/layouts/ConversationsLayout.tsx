import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Conversations from '../components/conversations/Conversations'
import Contacts from '../components/conversations/Contacts'
import GroupModal from '../components/conversations/GroupModal'
import MessageSearch from '../components/conversations/MessageSearch'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import BrandMark from '../components/ui/BrandMark'
import ThemeToggle from '../components/ui/ThemeToggle'
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
  const location = useLocation()
  usePresenceHeartbeat(true)

  // On mobile: show the list, or the open room — never both.
  const roomOpen = /^\/conversations\/[^/]+/.test(location.pathname)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className='app-shell' data-view={roomOpen ? 'room' : 'list'}>
      <Toaster position='top-right' toastOptions={{ className: 'rtm-toast' }} />

      <aside className='sidebar'>
        <header className='sidebar__header'>
          <BrandMark size={26} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ThemeToggle compact />
            <Link to='/profile' aria-label='Your profile'>
              <Avatar name={user?.name ?? '?'} src={user?.avatar_url} size='sm' />
            </Link>
            <Button variant='ghost' icon aria-label='Log out' onClick={() => void handleLogout()}>
              <span aria-hidden='true'>⏻</span>
            </Button>
          </div>
        </header>

        <MessageSearch />

        <div className='tabs' role='tablist' aria-label='Conversations and contacts'>
          <button
            type='button'
            role='tab'
            id='tab-chats'
            aria-selected={activeTab === 'chats'}
            aria-controls='panel-chats'
            className='tabs__tab'
            onClick={() => setActiveTab('chats')}
          >
            Chats
          </button>
          <button
            type='button'
            role='tab'
            id='tab-contacts'
            aria-selected={activeTab === 'contacts'}
            aria-controls='panel-contacts'
            className='tabs__tab'
            onClick={() => setActiveTab('contacts')}
          >
            Contacts
          </button>
        </div>

        <div
          className='sidebar__list scroll-y'
          role='tabpanel'
          id={activeTab === 'chats' ? 'panel-chats' : 'panel-contacts'}
          aria-labelledby={activeTab === 'chats' ? 'tab-chats' : 'tab-contacts'}
        >
          {activeTab === 'chats' ? (
            <Conversations conversations={conversations} isLoading={isLoading} error={error} />
          ) : (
            <Contacts onConversationOpened={() => setActiveTab('chats')} />
          )}
        </div>

        <footer className='sidebar__footer'>
          <Button variant='primary' block onClick={() => setIsGroupModalOpen(true)}>
            + New group
          </Button>
        </footer>
      </aside>

      <Outlet />

      {!roomOpen && (
        <div className='room room--empty'>
          <BrandMark size={44} withWordmark={false} />
          <p>Select a conversation to start chatting</p>
        </div>
      )}

      <GroupModal open={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />
    </div>
  )
}

export default ConversationsLayout
