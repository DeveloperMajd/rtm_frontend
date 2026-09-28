import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { ConnectionStatus } from 'laravel-echo'
import SearchPalette from '../components/conversations/SearchPalette'
import Avatar from '../components/ui/Avatar'
import BrandMark from '../components/ui/BrandMark'
import Icon from '../components/ui/Icon'
import SignalBars, { type SignalState } from '../components/ui/SignalBars'
import ThemeToggle from '../components/ui/ThemeToggle'
import useConversations from '../hooks/useConversations'
import useAuth from '../hooks/useAuth'
import usePresenceHeartbeat from '../hooks/usePresenceHeartbeat'
import useConnectionStatus from '../hooks/useConnectionStatus'
import type { AppShellContext, ListTab } from './appShellContext'

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

/**
 * Everything the signed-in app keeps on screen whichever page is open —
 * Chats or Settings: the primary rail (≥1024px), message search (⌘K), the
 * connection banner and the presence heartbeat. The pages render beside the
 * rail, through the Outlet.
 */
function AppShell() {
  const [activeTab, setActiveTab] = useState<ListTab>('chats')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { conversations } = useConversations()
  const { user } = useAuth()
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

  const inChats = location.pathname.startsWith('/conversations')
  const inSettings = !inChats
  // On mobile: show the list, or the open room — never both.
  const roomOpen = /^\/conversations\/[^/]+/.test(location.pathname)
  const view = inSettings ? 'settings' : roomOpen ? 'room' : 'list'

  const hasUnread = conversations.some((c) => !c.viewer_left_at && !!c.unread_count)

  // From Settings, the rail's Chats and Contacts go back to that list.
  const showList = (tab: ListTab) => {
    setActiveTab(tab)
    if (!inChats) navigate('/conversations')
  }

  const context: AppShellContext = {
    activeTab,
    setActiveTab,
    openSearch: () => setIsSearchOpen(true),
  }

  return (
    <div className='app-shell' data-view={view}>
      <a href='#main-content' className='skip-link'>
        Skip to main content
      </a>

      {connectionStatus !== 'connected' && (
        <div className={`connection-banner${connectionStatus === 'failed' ? ' is-failed' : ''}`} role='status'>
          {CONNECTION_LABEL[connectionStatus]}
        </div>
      )}

      {/* ≥1024px: the Signal primary rail. CSS-hidden below that, where the
          Chats screen's own sidebar and the Settings screen's back link
          stand in for it until Stage 10 (the design's 375/430/768 layouts). */}
      <nav className='rail' aria-label='Primary'>
        <div className='rail__brand'>
          <BrandMark size={24} withWordmark={false} />
        </div>

        <button
          type='button'
          className='rail__nav-btn'
          aria-current={inChats && activeTab === 'chats' ? 'page' : undefined}
          aria-label='Chats'
          onClick={() => showList('chats')}
        >
          <Icon name='chatDots' />
          {hasUnread && <span className='rail__dot' aria-hidden='true' />}
        </button>
        <button
          type='button'
          className='rail__nav-btn'
          aria-current={inChats && activeTab === 'contacts' ? 'page' : undefined}
          aria-label='Contacts'
          onClick={() => showList('contacts')}
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
        <ThemeToggle />
        <Link
          to='/profile'
          aria-label='Profile and settings'
          aria-current={inSettings ? 'page' : undefined}
          className='rail__avatar'
        >
          <Avatar name={user?.name ?? '?'} src={user?.avatar_url} size='sm' />
        </Link>
      </nav>

      <Outlet context={context} />

      <SearchPalette open={isSearchOpen} onClose={() => setIsSearchOpen(false)} conversations={conversations} />
    </div>
  )
}

export default AppShell
