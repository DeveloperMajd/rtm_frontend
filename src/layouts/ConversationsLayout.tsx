import { useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Conversations, { type ConversationFilter } from '../components/conversations/Conversations'
import Contacts from '../components/conversations/Contacts'
import GroupModal from '../components/conversations/GroupModal'
import AddContactModal from '../components/conversations/AddContactModal'
import SearchTrigger from '../components/conversations/SearchTrigger'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import BrandMark from '../components/ui/BrandMark'
import Icon from '../components/ui/Icon'
import ThemeToggle from '../components/ui/ThemeToggle'
import useConversations from '../hooks/useConversations'
import useAuth from '../hooks/useAuth'
import { useAppShell, type ListTab } from './appShellContext'

const TAB_ORDER: ListTab[] = ['chats', 'contacts']

const FILTERS: { key: ConversationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
  { key: 'direct', label: 'Direct' },
]

/** The Chats screen: the conversation (or contact) list beside the open
 * room. The rail, search and connection state around it are AppShell's. */
function ConversationsLayout() {
  const { activeTab, setActiveTab, openSearch } = useAppShell()
  const [filter, setFilter] = useState<ConversationFilter>('all')
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const { conversations, isLoading, error } = useConversations()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const roomOpen = /^\/conversations\/[^/]+/.test(location.pathname)

  const unreadCount = conversations.reduce(
    (total, c) => (!c.viewer_left_at ? total + (c.unread_count ?? 0) : total),
    0,
  )

  // WAI-ARIA tabs pattern: arrow keys move focus and switch tabs together
  // (automatic activation, matching the existing click behaviour); Home/End
  // jump to the first/last tab. Only the active tab is in the Tab order.
  // Drives the <1024px sidebar's tab switcher only — the ≥1024px rail
  // uses plain nav buttons (aria-current, sequential Tab order), matching
  // the design's own <nav>-with-aria-current markup rather than a tablist.
  const tabButtonRefs = useRef<Record<ListTab, HTMLButtonElement | null>>({
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

  return (
    <>
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
              <SearchTrigger onOpen={openSearch} />
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

      {/* <1024px: today's existing sidebar, unchanged, until Stage 10. Sign
          out has moved to Settings, one tap away behind the avatar. */}
      <aside className='sidebar'>
        <header className='sidebar__header'>
          <BrandMark size={26} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ThemeToggle />
            <Link to='/profile' aria-label='Profile and settings'>
              <Avatar name={user?.name ?? '?'} src={user?.avatar_url} size='sm' />
            </Link>
          </div>
        </header>

        <div className='sidebar-search'>
          <SearchTrigger onOpen={openSearch} />
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
    </>
  )
}

export default ConversationsLayout
