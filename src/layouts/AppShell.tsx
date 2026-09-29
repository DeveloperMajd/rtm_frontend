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
import useVisibleViewport from '../hooks/useVisibleViewport'
import { unreadTotal } from '../utils/conversations'
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

/** Which screen is showing — the CSS arranges the panes for it. From 768px
 * the list and the room sit side by side, as do the settings list and the
 * open page; on a phone it's one at a time, and the tab bar shows only on
 * the two top-level screens (the list, and the settings list). */
type ShellView = 'list' | 'room' | 'settings-hub' | 'settings'

/**
 * Everything the signed-in app keeps on screen whichever page is open —
 * Chats or Settings: the primary navigation, message search (⌘K), the
 * connection banner and the presence heartbeat. The pages render beside the
 * navigation, through the Outlet.
 *
 * The navigation is one element in two shapes: from 768px, the icon rail
 * down the left edge; on a phone, the tab bar along the bottom
 * (Mobile-430-Chats) — Chats, Contacts, Search and Profile.
 */
function AppShell() {
  const [activeTab, setActiveTab] = useState<ListTab>('chats')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { conversations } = useConversations()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  usePresenceHeartbeat(true)
  useVisibleViewport()

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

  const { pathname } = location
  const inChats = pathname.startsWith('/conversations')
  const inSettings = !inChats
  const roomOpen = /^\/conversations\/[^/]+/.test(pathname)
  const view: ShellView = inChats ? (roomOpen ? 'room' : 'list') : pathname === '/me' ? 'settings-hub' : 'settings'

  const unread = unreadTotal(conversations)
  const signal = SIGNAL_STATE[connectionStatus]

  // From Settings, the rail's Chats and Contacts go back to that list.
  const showList = (tab: ListTab) => {
    setActiveTab(tab)
    if (!inChats) navigate('/conversations')
  }

  const context: AppShellContext = {
    activeTab,
    setActiveTab,
    openSearch: () => setIsSearchOpen(true),
    signal,
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

      <nav className='rail' aria-label='Primary'>
        <div className='rail__brand'>
          <BrandMark size={24} withWordmark={false} />
        </div>

        <button
          type='button'
          className='rail__nav-btn'
          aria-current={inChats && activeTab === 'chats' ? 'page' : undefined}
          aria-label={unread > 0 ? `Chats, ${unread} unread` : 'Chats'}
          onClick={() => showList('chats')}
        >
          <span className='rail__icon'>
            <Icon name='chatDots' />
            {/* The rail marks unread with a dot; the tab bar counts. */}
            {unread > 0 && (
              <>
                <span className='rail__dot' aria-hidden='true' />
                <span className='rail__count' aria-hidden='true'>
                  {unread > 99 ? '99+' : unread}
                </span>
              </>
            )}
          </span>
          <span className='rail__label' aria-hidden='true'>
            Chats
          </span>
        </button>
        <button
          type='button'
          className='rail__nav-btn'
          aria-current={inChats && activeTab === 'contacts' ? 'page' : undefined}
          aria-label='Contacts'
          onClick={() => showList('contacts')}
        >
          <span className='rail__icon'>
            <Icon name='users' />
          </span>
          <span className='rail__label' aria-hidden='true'>
            Contacts
          </span>
        </button>
        <button
          type='button'
          className='rail__nav-btn'
          aria-label='Search messages'
          aria-haspopup='dialog'
          onClick={() => setIsSearchOpen(true)}
        >
          <span className='rail__icon'>
            <Icon name='search' />
          </span>
          <span className='rail__label' aria-hidden='true'>
            Search
          </span>
        </button>

        <div className='rail__spacer' />

        {/* Rail only: on a phone the connection shows beside the Chats
            title, and the theme lives in Settings → Appearance. */}
        <span className='rail__signal' title={CONNECTION_LABEL[connectionStatus] || 'Connected'}>
          <SignalBars state={signal} />
        </span>
        <span className='rail__theme'>
          <ThemeToggle />
        </span>
        <Link
          to='/profile'
          aria-label='Profile and settings'
          aria-current={inSettings ? 'page' : undefined}
          className='rail__avatar'
        >
          <Avatar name={user?.name ?? '?'} src={user?.avatar_url} size='sm' />
        </Link>

        {/* Tab bar only: Profile opens the settings list, which on a phone
            is a screen of its own (Profile-Mobile). */}
        <Link
          to='/me'
          aria-label='Profile'
          aria-current={inSettings ? 'page' : undefined}
          className='rail__nav-btn rail__me'
        >
          <span className='rail__icon'>
            <Avatar name={user?.name ?? '?'} src={user?.avatar_url} size='xs' />
          </span>
          <span className='rail__label' aria-hidden='true'>
            Profile
          </span>
        </Link>
      </nav>

      <Outlet context={context} />

      <SearchPalette open={isSearchOpen} onClose={() => setIsSearchOpen(false)} conversations={conversations} />
    </div>
  )
}

export default AppShell
