import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { ConversationType } from '../../utils/baseTypes'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { ConversationListSkeleton } from '../ui/Skeleton'
import { systemMessageText } from '../../utils/systemMessageText'
import useAuth from '../../hooks/useAuth'
import useConversationPreferences, { type PreferenceChanges } from '../../hooks/useConversationPreferences'
import { conversationTitle } from '../../utils/conversations'

export type ConversationFilter = 'all' | 'unread' | 'groups' | 'direct'

const previewFor = (c: ConversationType, viewerId?: string): string => {
  if (!c.latest_message) return 'No messages yet'
  if (c.latest_message.type === 'system') return systemMessageText(c.latest_message, viewerId)
  const { sender_name, body } = c.latest_message
  return `${sender_name ? sender_name + ': ' : ''}${body}`
}

const matchesFilter = (c: ConversationType, filter: ConversationFilter): boolean => {
  switch (filter) {
    case 'unread':
      return !c.viewer_left_at && !!c.unread_count
    case 'groups':
      return c.type === 'group'
    case 'direct':
      return c.type === 'direct'
    case 'all':
      return true
  }
}

/** Which of a row's actions was used last — to put focus back on it when
 * the row moves (pinning sends it to the top), or on the list when it
 * leaves (archiving). */
type LastAction = { conversationId: string; action: keyof PreferenceChanges }

/**
 * A conversation row's Pin, Mute and Archive, shown on hover or focus.
 * Rendered as siblings of the row's `NavLink`, not nested inside it — a
 * `<button>` inside an `<a>` is invalid HTML and breaks keyboard and
 * assistive-tech navigation. A group the viewer has left offers Archive
 * only: nothing new arrives there to pin or mute.
 */
const QuickActions = ({
  conversation: c,
  onChange,
}: {
  conversation: ConversationType
  onChange: (changes: PreferenceChanges) => void
}) => {
  const left = Boolean(c.viewer_left_at)
  const pinned = Boolean(c.pinned_at)
  const muted = Boolean(c.muted_at)
  const archived = Boolean(c.archived_at)

  return (
    <span className='conversation-item__quick-actions' data-conversation-id={c.id}>
      {!left && !archived && (
        <Tooltip label={pinned ? 'Unpin' : 'Pin to the top'}>
          <button
            type='button'
            className='conversation-item__action'
            data-action='pinned'
            aria-label={`Pin ${conversationTitle(c)}`}
            aria-pressed={pinned}
            onClick={() => onChange({ pinned: !pinned })}
          >
            <Icon name='pin' size={14} />
          </button>
        </Tooltip>
      )}
      {!left && (
        <Tooltip label={muted ? 'Unmute' : 'Mute'}>
          <button
            type='button'
            className='conversation-item__action'
            data-action='muted'
            aria-label={`Mute ${conversationTitle(c)}`}
            aria-pressed={muted}
            onClick={() => onChange({ muted: !muted })}
          >
            <Icon name={muted ? 'bell' : 'bellOff'} size={14} />
          </button>
        </Tooltip>
      )}
      <Tooltip label={archived ? 'Move back to Chats' : 'Archive'}>
        <button
          type='button'
          className='conversation-item__action'
          data-action='archived'
          aria-label={archived ? `Unarchive ${conversationTitle(c)}` : `Archive ${conversationTitle(c)}`}
          onClick={() => onChange({ archived: !archived })}
        >
          <Icon name='archive' size={14} />
        </button>
      </Tooltip>
    </span>
  )
}

type ConversationsProps = {
  conversations: ConversationType[]
  isLoading: boolean
  error: Error | null
  filter?: ConversationFilter
  /** The main list, or the archived conversations instead. */
  view?: 'chats' | 'archived'
  onShowArchived?: () => void
  onShowChats?: () => void
  /** The ways out of an empty list — each button shows only when given. */
  onShowAll?: () => void
  onAddContact?: () => void
  onNewGroup?: () => void
  onRetry?: () => void
}

const Conversations = ({
  conversations,
  isLoading,
  error,
  filter = 'all',
  view = 'chats',
  onShowArchived,
  onShowChats,
  onShowAll,
  onAddContact,
  onNewGroup,
  onRetry,
}: ConversationsProps) => {
  const { user } = useAuth()
  const changePreferences = useConversationPreferences()
  const listRef = useRef<HTMLDivElement>(null)
  const lastActionRef = useRef<LastAction | null>(null)

  const change = (conversation: ConversationType, changes: PreferenceChanges) => {
    lastActionRef.current = { conversationId: conversation.id, action: Object.keys(changes)[0] as keyof PreferenceChanges }
    changePreferences(conversation, changes)
  }

  // A row that moved (pinned to the top, or unpinned back down) can take
  // focus with it out of the document; one that left the list (archived)
  // certainly does. Put it back: on the same button if the row is still
  // here, otherwise on the list itself.
  useLayoutEffect(() => {
    const last = lastActionRef.current
    if (!last) return
    const focusIsLost = !document.activeElement || document.activeElement === document.body
    if (!focusIsLost) return
    lastActionRef.current = null
    const button = listRef.current?.querySelector<HTMLElement>(
      `[data-conversation-id="${last.conversationId}"] [data-action="${last.action}"]`,
    )
    if (button) button.focus()
    else document.getElementById('chat-list')?.focus()
  })

  if (isLoading && conversations.length === 0) {
    return <ConversationListSkeleton />
  }

  // Only when there's nothing to show instead: a failed background refresh
  // leaves the list it already has on screen (the next poll tries again).
  if (error && conversations.length === 0) {
    return (
      <EmptyState
        icon='wifiOff'
        tone='danger'
        title='Couldn’t load your chats'
        actions={
          onRetry && (
            <Button variant='secondary' className='sm' onClick={onRetry}>
              <Icon name='refresh' size={14} />
              Try again
            </Button>
          )
        }
      >
        Check your connection and try again. Nothing was lost.
      </EmptyState>
    )
  }

  const archived = conversations.filter((c) => c.archived_at)

  // --- The archived conversations, instead of the main list ---
  if (view === 'archived') {
    return (
      <div ref={listRef}>
        <div className='list-archived-head'>
          {onShowChats && (
            <button type='button' className='list-archived-head__back' aria-label='Back to chats' onClick={onShowChats}>
              <Icon name='arrowLeft' size={16} />
            </button>
          )}
          <h2 className='list-archived-head__title'>Archived</h2>
        </div>
        {archived.length === 0 ? (
          <EmptyState icon='archive' title='Nothing archived'>
            Archive a chat to tidy it away. A new message brings it back, unless it’s muted.
          </EmptyState>
        ) : (
          <ul>{archived.map(renderRow)}</ul>
        )}
      </div>
    )
  }

  const filtered = conversations.filter((c) => !c.archived_at && matchesFilter(c, filter))

  // The way into Archived, under the main list (not under a filter).
  const archivedEntry = filter === 'all' && archived.length > 0 && onShowArchived && (
    <button type='button' className='archived-entry' onClick={onShowArchived}>
      <span className='archived-entry__icon' aria-hidden='true'>
        <Icon name='archive' size={18} />
      </span>
      <span className='archived-entry__label'>Archived</span>
      <span className='archived-entry__count'>{archived.length}</span>
      <Icon name='chevR' size={16} />
    </button>
  )

  if (filtered.length === 0) {
    const addContact = onAddContact && (
      <Button variant={filter === 'all' || filter === 'direct' ? 'primary' : 'secondary'} className='sm' onClick={onAddContact}>
        <Icon name='userPlus' size={14} />
        Add contact
      </Button>
    )
    const newGroup = onNewGroup && (
      <Button variant={filter === 'groups' ? 'primary' : 'secondary'} className='sm' onClick={onNewGroup}>
        <Icon name='users' size={14} />
        New group
      </Button>
    )

    // States-Empty: a new account, then one per filter.
    switch (filter) {
      case 'all':
        // Everything archived is not the same as nothing yet.
        if (archivedEntry) {
          return (
            <div ref={listRef}>
              <EmptyState icon='archive' title='All your chats are archived'>
                They’re still there, in Archived.
              </EmptyState>
              {archivedEntry}
            </div>
          )
        }
        return (
          <EmptyState
            icon='chat'
            title='No conversations yet'
            actions={(addContact || newGroup) && <>{addContact}{newGroup}</>}
          >
            Add a contact to start a direct chat, or create a group.
          </EmptyState>
        )
      case 'unread':
        return (
          <EmptyState
            icon='checks'
            title='You’re all caught up'
            actions={
              onShowAll && (
                <Button variant='secondary' className='sm' onClick={onShowAll}>
                  Show all
                </Button>
              )
            }
          >
            No unread conversations right now.
          </EmptyState>
        )
      case 'groups':
        return (
          <EmptyState icon='users' title='No groups yet' actions={newGroup}>
            Groups let you talk with several people at once, with admins.
          </EmptyState>
        )
      case 'direct':
        return (
          <EmptyState icon='user' title='No direct chats yet' actions={addContact}>
            Add a contact and your chat with them opens right away.
          </EmptyState>
        )
    }
  }

  const pinned = filtered.filter((c) => c.pinned_at)
  const rest = filtered.filter((c) => !c.pinned_at)

  return (
    <div ref={listRef}>
      {pinned.length > 0 ? (
        <>
          <ListSection title='Pinned'>{pinned.map(renderRow)}</ListSection>
          {rest.length > 0 && <ListSection title='Chats'>{rest.map(renderRow)}</ListSection>}
        </>
      ) : (
        <ul>{rest.map(renderRow)}</ul>
      )}
      {archivedEntry}
    </div>
  )

  function renderRow(c: ConversationType) {
    const title = conversationTitle(c)
    const when = c.last_message_at || c.updated_at
    const left = Boolean(c.viewer_left_at)
    const unread = !left && !!c.unread_count
    const muted = Boolean(c.muted_at)

    return (
      <li key={c.id} className='conversation-item-row'>
        <NavLink
          to={`/conversations/${c.id}`}
          className={({ isActive }) =>
            `conversation-item${isActive ? ' is-active' : ''}${left ? ' is-left' : ''}${unread ? ' has-unread' : ''}${muted ? ' is-muted' : ''}`
          }
        >
          <Avatar
            name={title}
            src={c.type === 'direct' ? c.other_participant?.avatar_url : null}
            kind={c.type === 'group' ? 'group' : 'user'}
            size='md'
            online={c.type === 'direct' ? c.other_participant?.is_online : undefined}
          />
          <div className='conversation-item__body'>
            <div className='conversation-item__top'>
              <span className='conversation-item__title'>{title}</span>
              {c.pinned_at && (
                <span className='conversation-item__flag'>
                  <Icon name='pin' size={13} />
                  <span className='sr-only'>, pinned</span>
                </span>
              )}
              {muted && (
                <span className='conversation-item__flag'>
                  <Icon name='bellOff' size={13} />
                  <span className='sr-only'>, muted</span>
                </span>
              )}
              {when && (
                <time className='conversation-item__time' dateTime={when}>
                  {formatDistanceToNow(new Date(when), { addSuffix: true })}
                </time>
              )}
            </div>
            <div className='conversation-item__top'>
              <span className='conversation-item__preview'>{previewFor(c, user?.id)}</span>
              {unread && (
                <span
                  className={`unread-pill${muted ? ' is-muted' : ''}`}
                  aria-label={`${c.unread_count} unread messages`}
                >
                  {c.unread_count}
                </span>
              )}
              {left && <span className='badge badge--left'>Left</span>}
            </div>
          </div>
        </NavLink>
        <QuickActions conversation={c} onChange={(changes) => change(c, changes)} />
      </li>
    )
  }
}

/** A labelled run of rows — "Pinned", then the rest as "Chats". */
const ListSection = ({ title, children }: { title: string; children: ReactNode }) => {
  const id = `list-section-${title.toLowerCase()}`
  return (
    <div role='group' aria-labelledby={id}>
      <h2 id={id} className='list-section'>
        {title}
      </h2>
      <ul>{children}</ul>
    </div>
  )
}

export default Conversations
