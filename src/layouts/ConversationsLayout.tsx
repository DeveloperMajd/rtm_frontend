import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { ConnectionStatus } from 'laravel-echo'
import { mdiLogout } from '@mdi/js'
import Conversations from '../components/conversations/Conversations'
import Contacts from '../components/conversations/Contacts'
import GroupModal from '../components/conversations/GroupModal'
import MessageSearch from '../components/conversations/MessageSearch'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import BrandMark from '../components/ui/BrandMark'
import Icon from '../components/ui/Icon'
import ThemeToggle from '../components/ui/ThemeToggle'
import useConversations from '../hooks/useConversations'
import useAuth from '../hooks/useAuth'
import usePresenceHeartbeat from '../hooks/usePresenceHeartbeat'
import useConnectionStatus from '../hooks/useConnectionStatus'

type Tab = 'chats' | 'contacts'

const TAB_ORDER: Tab[] = ['chats', 'contacts']

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connected: '',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  disconnected: 'Reconnecting…',
  failed: "Connection lost — retrying…",
}

function ConversationsLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const { conversations, isLoading, error } = useConversations()
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  usePresenceHeartbeat(true)

  // Echo/Pusher already retries on its own — this only surfaces the state.
  // Debounced so a sub-400ms blip (a normal reconnect) never flashes a banner;
  // clearing the banner goes through the same timer (at 0ms) so every branch
  // sets state from the timeout callback rather than the effect body itself.
  const rawConnectionStatus = useConnectionStatus()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected')
  useEffect(() => {
    const delay = rawConnectionStatus === 'connected' ? 0 : 400
    const timeout = setTimeout(() => setConnectionStatus(rawConnectionStatus), delay)
    return () => clearTimeout(timeout)
  }, [rawConnectionStatus])

  // On mobile: show the list, or the open room — never both.
  const roomOpen = /^\/conversations\/[^/]+/.test(location.pathname)

  // WAI-ARIA tabs pattern: arrow keys move focus and switch tabs together
  // (automatic activation, matching the existing click behaviour); Home/End
  // jump to the first/last tab. Only the active tab is in the Tab order.
  const tabButtonRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    chats: null,
    contacts: null,
  })

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()

    const currentIndex = TAB_ORDER.indexOf(activeTab)
    const nextIndex =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? TAB_ORDER.length - 1
          : (currentIndex + (e.key === 'ArrowRight' ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length

    const nextTab = TAB_ORDER[nextIndex]
    setActiveTab(nextTab)
    tabButtonRefs.current[nextTab]?.focus()
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className='app-shell' data-view={roomOpen ? 'room' : 'list'}>
      <a href='#main-content' className='skip-link'>
        Skip to conversation
      </a>

      {connectionStatus !== 'connected' && (
        <div className={`connection-banner${connectionStatus === 'failed' ? ' is-failed' : ''}`} role='status'>
          {CONNECTION_LABEL[connectionStatus]}
        </div>
      )}

      <aside className='sidebar'>
        <header className='sidebar__header'>
          <BrandMark size={26} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ThemeToggle compact />
            <Link to='/profile' aria-label='Your profile'>
              <Avatar name={user?.name ?? '?'} src={user?.avatar_url} size='sm' />
            </Link>
            <Button variant='ghost' icon aria-label='Log out' onClick={() => void handleLogout()}>
              <Icon path={mdiLogout} />
            </Button>
          </div>
        </header>

        <MessageSearch />

        <div className='tabs' role='tablist' aria-label='Conversations and contacts'>
          <button
            ref={(el) => {
              tabButtonRefs.current.chats = el
            }}
            type='button'
            role='tab'
            id='tab-chats'
            aria-selected={activeTab === 'chats'}
            aria-controls='panel-chats'
            tabIndex={activeTab === 'chats' ? 0 : -1}
            className='tabs__tab'
            onClick={() => setActiveTab('chats')}
            onKeyDown={handleTabKeyDown}
          >
            Chats
          </button>
          <button
            ref={(el) => {
              tabButtonRefs.current.contacts = el
            }}
            type='button'
            role='tab'
            id='tab-contacts'
            aria-selected={activeTab === 'contacts'}
            aria-controls='panel-contacts'
            tabIndex={activeTab === 'contacts' ? 0 : -1}
            className='tabs__tab'
            onClick={() => setActiveTab('contacts')}
            onKeyDown={handleTabKeyDown}
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

      <main id='main-content' className='main-content' tabIndex={-1}>
        <Outlet />

        {!roomOpen && (
          <div className='room room--empty'>
            <BrandMark size={44} withWordmark={false} />
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </main>

      <GroupModal open={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} />
    </div>
  )
}

export default ConversationsLayout
