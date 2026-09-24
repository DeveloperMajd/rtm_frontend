import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { ConnectionStatus } from 'laravel-echo'
import Conversations, { type ConversationFilter } from '../components/conversations/Conversations'
import Contacts from '../components/conversations/Contacts'
import GroupModal from '../components/conversations/GroupModal'
import AddContactModal from '../components/conversations/AddContactModal'
import SearchPalette from '../components/conversations/SearchPalette'
import SearchTrigger from '../components/conversations/SearchTrigger'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import BrandMark from '../components/ui/BrandMark'
import Icon from '../components/ui/Icon'
import SignalBars, { type SignalState } from '../components/ui/SignalBars'
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

// laravel-echo's ConnectionStatus has a couple more values than the rail's
// signal glyph distinguishes between — this collapses them onto the same
// four states DS-Signal-Motion actually draws.
const SIGNAL_STATE: Record<ConnectionStatus, SignalState> = {
  connected: 'connected',
  connecting: 'connecting',
  reconnecting: 'reconnecting',
  disconnected: 'reconnecting',
  failed: 'offline',
}

const FILTERS: { key: ConversationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
  { key: 'direct', label: 'Direct' },
]

function ConversationsLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [filter, setFilter] = useState<ConversationFilter>('all')
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const { conversations, isLoading, error } = useConversations()
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
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

  // ⌘K / Ctrl+K opens message search from anywhere in the app shell,
  // including from inside the composer. A second press while it's open is
  // left alone (the palette's own field has focus by then).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // On mobile: show the list, or the open room — never both.
  const roomOpen = /^\/conversations\/[^/]+/.test(location.pathname)

  const hasUnread = conversations.some((c) => !c.viewer_left_at && !!c.unread_count)
  const unreadCount = conversations.reduce(
    (total, c) => (!c.viewer_left_at ? total + (c.unread_count ?? 0) : total),
    0,
  )

  // WAI-ARIA tabs pattern: arrow keys move focus and switch tabs together
  // (automatic activation, matching the existing click behaviour); Home/End
  // jump to the first/last tab. Only the active tab is in the Tab order.
  // Drives the <1024px sidebar's tab switcher only — the ≥1024px rail below
  // uses plain nav buttons (aria-current, sequential Tab order), matching
  // the design's own <nav>-with-aria-current markup rather than a tablist.
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

      {/* ≥1024px: the Signal primary rail. CSS-hidden below that — the
          <aside className="sidebar"> further down keeps serving every
          narrower width unchanged until Stage 10 rebuilds it (its own
          breakpoints: 375/430/768/1024). Both are mounted at once and
          toggled by CSS, not JS, per the project's responsive rule. */}
      <nav className='rail' aria-label='Primary'>
        <div className='rail__brand'>
          <BrandMark size={24} withWordmark={false} />
        </div>

        <button
          type='button'
          className='rail__nav-btn'
          aria-current={activeTab === 'chats' ? 'page' : undefined}
          aria-label='Chats'
          onClick={() => setActiveTab('chats')}
        >
          <Icon name='chatDots' />
          {hasUnread && <span className='rail__dot' aria-hidden='true' />}
        </button>
        <button
          type='button'
          className='rail__nav-btn'
          aria-current={activeTab === 'contacts' ? 'page' : undefined}
          aria-label='Contacts'
          onClick={() => setActiveTab('contacts')}
        >
          <Icon name='users' />
        </button>
        <button
          type='button'
          className='rail__nav-btn'
          aria-label='Search messages'
          aria-haspopup='dialog'
          onClick={() => setIsSearchOpen(true)}
        >
          <Icon name='search' />
        </button>

        <div className='rail__spacer' />

        <span className='rail__signal' title={CONNECTION_LABEL[connectionStatus] || 'Connected'}>
          <SignalBars state={SIGNAL_STATE[connectionStatus]} />
        </span>
        <ThemeToggle compact />
        <Link to='/profile' aria-label='Your profile' className='rail__avatar'>
          <Avatar name={user?.name ?? '?'} src={user?.avatar_url} size='sm' />
        </Link>
        {/* Interim only: the design tucks "Sign out" into Settings
            (Stage 9), which doesn't exist yet. Kept here, unstyled into
            the rail's own icon set, so logging out isn't lost until then. */}
        <Button variant='ghost' icon aria-label='Log out' onClick={() => void handleLogout()}>
          <Icon name='logout' />
        </Button>
      </nav>

      <section className='list-pane' aria-label={activeTab === 'chats' ? 'Conversations' : 'Contacts'}>
        <header className='list-pane__header'>
          <h1 className='list-pane__title'>{activeTab === 'chats' ? 'Chats' : 'Contacts'}</h1>
          {activeTab === 'chats' ? (
            <button
              type='button'
              className='list-pane__icon-btn'
              aria-label='New group'
              onClick={() => setIsGroupModalOpen(true)}
            >
              <Icon name='plus' />
            </button>
          ) : (
            <button
              type='button'
              className='list-pane__icon-btn'
              aria-label='Add contact'
              onClick={() => setIsAddContactOpen(true)}
            >
              <Icon name='userPlus' />
            </button>
          )}
        </header>

        {activeTab === 'chats' && (
          <>
            <div className='list-pane__search'>
              <SearchTrigger onOpen={() => setIsSearchOpen(true)} />
            </div>
            <div className='list-pane__filters' role='group' aria-label='Filter conversations'>
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type='button'
                  className='chip'
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  {key === 'unread' && unreadCount > 0 && <span className='chip__count'>{unreadCount}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <div className='list-pane__list scroll-y'>
          {activeTab === 'chats' ? (
            <Conversations conversations={conversations} isLoading={isLoading} error={error} filter={filter} />
          ) : (
            <Contacts onConversationOpened={() => setActiveTab('chats')} onAddContact={() => setIsAddContactOpen(true)} />
          )}
        </div>
      </section>

      {/* <1024px: today's existing sidebar, unchanged, until Stage 10. */}
      <aside className='sidebar'>
        <header className='sidebar__header'>
          <BrandMark size={26} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ThemeToggle compact />
            <Link to='/profile' aria-label='Your profile'>
              <Avatar name={user?.name ?? '?'} src={user?.avatar_url} size='sm' />
            </Link>
            <Button variant='ghost' icon aria-label='Log out' onClick={() => void handleLogout()}>
              <Icon name='logout' />
            </Button>
          </div>
        </header>

        <div className='sidebar-search'>
          <SearchTrigger onOpen={() => setIsSearchOpen(true)} />
        </div>

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
            <Contacts onConversationOpened={() => setActiveTab('chats')} onAddContact={() => setIsAddContactOpen(true)} />
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

      <GroupModal
        open={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onAddContact={() => {
          setActiveTab('contacts')
          setIsAddContactOpen(true)
        }}
      />
      <AddContactModal
        open={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        onAdded={(conversationId) => {
          navigate(`/conversations/${conversationId}`)
          setActiveTab('chats')
        }}
      />
      <SearchPalette
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        conversations={conversations}
      />
    </div>
  )
}

export default ConversationsLayout
