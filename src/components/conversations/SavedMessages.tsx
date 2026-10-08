import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'
import { ConversationListSkeleton } from '../ui/Skeleton'
import useAuth from '../../hooks/useAuth'
import { useSavedMessages, useToggleSaved } from '../../hooks/useSavedMessages'
import type { SavedMessage } from '../../services/api/savedMessages'
import { messagePath } from '../../utils/messageLinks'
import { previewOf } from '../../utils/messagePreview'
import { resultTime } from '../../utils/searchText'

/**
 * Where a saved message was said, when the sender's name doesn't already
 * say it: in a group, or with someone in a direct conversation the viewer
 * spoke in. Someone else's message in a direct conversation needs nothing:
 * that conversation is them.
 */
function placeOf({ conversation }: SavedMessage, isOwn: boolean): { word: string; name: string } | null {
  if (conversation.type === 'group') return { word: 'in', name: conversation.title || 'Untitled group' }
  return isOwn ? { word: 'with', name: conversation.title || 'Direct conversation' } : null
}

/**
 * The Saved list, the rail's third beside Chats and Contacts: the messages
 * the viewer has saved, most recently saved first. Each opens its
 * conversation at the message (beside the list from 768px), and the
 * bookmark beside it takes it off the list. That one is always on show,
 * unlike the chat list's row actions, so a touch screen has it too.
 */
const SavedMessages = () => {
  const { user } = useAuth()
  const { data, isPending, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } =
    useSavedMessages()
  const toggleSaved = useToggleSaved()
  const listRef = useRef<HTMLUListElement>(null)
  // Where the row whose bookmark was just used sat: once it's gone, focus
  // goes to the one that takes its place, so the keyboard can carry on
  // down the list, or to the list itself when nothing's left.
  const removedAt = useRef<number | null>(null)

  const saved = data?.pages.flatMap((page) => page.data) ?? []

  useLayoutEffect(() => {
    const at = removedAt.current
    if (at === null) return
    const focusIsLost = !document.activeElement || document.activeElement === document.body
    if (!focusIsLost) return
    removedAt.current = null
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('.saved-item__remove')
    const next = buttons?.[Math.min(at, buttons.length - 1)]
    if (next) next.focus()
    else document.getElementById('chat-list')?.focus()
  })

  if (isPending) return <ConversationListSkeleton />

  if (error && saved.length === 0) {
    return (
      <EmptyState
        icon='wifiOff'
        tone='danger'
        title='Couldn’t load your saved messages'
        actions={
          <Button variant='secondary' className='sm' onClick={() => void refetch()}>
            <Icon name='refresh' size={14} />
            Try again
          </Button>
        }
      >
        Check your connection and try again. Nothing was lost.
      </EmptyState>
    )
  }

  if (saved.length === 0) {
    return (
      <EmptyState icon='bookmark' title='No saved messages'>
        Save a message from its menu to keep it here, from any of your chats. Only you see what you save.
      </EmptyState>
    )
  }

  return (
    <>
      <ul ref={listRef}>
        {saved.map((item, index) => {
          const { message } = item
          const isOwn = message.sender?.id === user?.id
          const who = isOwn ? 'You' : (message.sender?.name ?? 'Unknown')
          const place = placeOf(item, isOwn)

          return (
            <li key={item.id} className='conversation-item-row saved-item-row'>
              <Link to={messagePath(item.conversation.id, message.id)} className='conversation-item saved-item'>
                {/* The sender's name is in the text beside it: said once. */}
                <span aria-hidden='true'>
                  <Avatar name={message.sender?.name ?? '?'} src={message.sender?.avatar_url} size='md' />
                </span>
                <div className='conversation-item__body'>
                  {/* The spaces between the parts are text of their own,
                      outside the parts, so the link's name reads "Sam in
                      Team 4 Mar …" rather than running the words together. */}
                  <div className='conversation-item__top'>
                    <span className='conversation-item__title'>
                      {who}
                      {place && (
                        <>
                          {' '}
                          <span className='saved-item__place'>
                            <span aria-hidden='true'>·</span> <span className='sr-only'>{place.word}</span> {place.name}
                          </span>
                        </>
                      )}
                    </span>{' '}
                    <time className='conversation-item__time' dateTime={message.created_at}>
                      {resultTime(message.created_at)}
                    </time>
                  </div>
                  <p className='saved-item__text'>{previewOf(message)}</p>
                </div>
              </Link>
              <Tooltip label='Remove from saved'>
                <button
                  type='button'
                  className='saved-item__remove'
                  aria-label={isOwn ? 'Remove your message from saved' : `Remove ${who}’s message from saved`}
                  onClick={() => {
                    removedAt.current = index
                    toggleSaved(message.id, false)
                  }}
                >
                  <Icon name='bookmark' size={16} />
                </button>
              </Tooltip>
            </li>
          )
        })}
      </ul>

      {hasNextPage && (
        <div className='saved-more'>
          <Button variant='secondary' className='sm' loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            {isFetchNextPageError ? 'Couldn’t load more. Try again' : 'Show more'}
          </Button>
        </div>
      )}
    </>
  )
}

export default SavedMessages
