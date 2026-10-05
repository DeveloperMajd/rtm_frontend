import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Conversations, { type ConversationFilter } from '../components/conversations/Conversations'
import Contacts from '../components/conversations/Contacts'
import GroupModal from '../components/conversations/GroupModal'
import AddContactModal from '../components/conversations/AddContactModal'
import SearchTrigger from '../components/conversations/SearchTrigger'
import BottomSheet, { SheetAction } from '../components/ui/BottomSheet'
import StartScreen from '../components/conversations/StartScreen'
import useAuth from '../hooks/useAuth'
import Icon from '../components/ui/Icon'
import SignalBars from '../components/ui/SignalBars'
import useConversations from '../hooks/useConversations'
import { unreadTotal } from '../utils/conversations'
import { LIVE_LABEL } from '../utils/connection'
import { useAppShell } from './appShellContext'

const FILTERS: { key: ConversationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
  { key: 'direct', label: 'Direct' },
]

/** The Chats screen: the conversation (or contact) list beside the open
 * room — or, on a phone, one or the other. The navigation, search and
 * connection state around it are AppShell's. */
function ConversationsLayout() {
  const shell = useAppShell()
  const { activeTab, setActiveTab, openSearch, signal, connection } = shell
  const [filter, setFilter] = useState<ConversationFilter>('all')
  // The archived conversations, in the list's place (no filters there).
  const [listView, setListView] = useState<'chats' | 'archived'>('chats')
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isAddContactOpen, setIsAddContactOpen] = useState(false)
  const { conversations, isLoading, error, retry, isReady } = useConversations()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const roomOpen = /^\/conversations\/[^/]+/.test(location.pathname)
  const unreadCount = unreadTotal(conversations)

  return (
    <>
      <section
        id='chat-list'
        tabIndex={-1}
        className='list-pane'
        aria-label={activeTab === 'chats' ? 'Conversations' : 'Contacts'}
      >
        <header className='list-pane__header'>
          <div className='list-pane__heading'>
            <h1 className='list-pane__title'>{activeTab === 'chats' ? 'Chats' : 'Contacts'}</h1>
            {activeTab === 'chats' && (
              // Phone only: the rail shows the connection from 768px.
              <span className={`list-pane__live is-${signal}`}>
                <SignalBars state={signal} />
                {LIVE_LABEL[connection]}
              </span>
            )}
          </div>
          {activeTab === 'chats' ? (
            <>
              <button
                type='button'
                className='list-pane__icon-btn'
                aria-label='New group'
                onClick={() => setIsGroupModalOpen(true)}
              >
                <Icon name='plus' />
              </button>
              {/* Phone: one button for both ways to start a conversation
                  (Mobile-NewChat-Flow), in a sheet. */}
              <button
                type='button'
                className='list-pane__new'
                aria-label='New conversation'
                aria-haspopup='dialog'
                onClick={() => setIsNewOpen(true)}
              >
                <Icon name='plus' />
              </button>
            </>
          ) : (
            <button
              type='button'
              className='list-pane__icon-btn is-always'
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
            <div className='list-pane__filters' role='group' aria-label='Filter conversations' hidden={listView === 'archived'}>
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
            <Conversations
              conversations={conversations}
              isLoading={isLoading}
              error={error}
              filter={filter}
              view={listView}
              onShowArchived={() => setListView('archived')}
              onShowChats={() => setListView('chats')}
              onShowAll={() => setFilter('all')}
              onAddContact={() => setIsAddContactOpen(true)}
              onNewGroup={() => setIsGroupModalOpen(true)}
              onRetry={retry}
            />
          ) : (
            <Contacts onConversationOpened={() => setActiveTab('chats')} onAddContact={() => setIsAddContactOpen(true)} />
          )}
        </div>
      </section>

      <main id='main-content' className='main-content' tabIndex={-1}>
        {/* The room reads the connection state from here, too. */}
        <Outlet context={shell} />

        {!roomOpen && (
          <StartScreen
            isNewAccount={isReady && !error && conversations.length === 0}
            firstName={user?.name.split(' ')[0] ?? ''}
            onNewConversation={() => setIsNewOpen(true)}
            onAddContact={() => setIsAddContactOpen(true)}
            onNewGroup={() => setIsGroupModalOpen(true)}
            onSearch={openSearch}
          />
        )}
      </main>

      <BottomSheet open={isNewOpen} onClose={() => setIsNewOpen(false)} title='New conversation'>
        <div className='sheet-actions'>
          <SheetAction
            icon='userPlus'
            label='Add contact'
            hint='Find someone by name or email'
            onSelect={() => {
              setIsNewOpen(false)
              setIsAddContactOpen(true)
            }}
          />
          <SheetAction
            icon='users'
            label='New group'
            hint='A name and the people to include'
            onSelect={() => {
              setIsNewOpen(false)
              setIsGroupModalOpen(true)
            }}
          />
        </div>
      </BottomSheet>

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
