import type { KeyboardEvent, Ref } from 'react'
import type { ConversationSearch } from '../../hooks/useConversationSearch'
import { MIN_CHARS } from '../../hooks/useConversationSearch'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import SignalBars from '../ui/SignalBars'
import Tooltip from '../ui/Tooltip'

interface ConversationSearchBarProps {
  id: string
  search: ConversationSearch
  onClose: () => void
  inputRef?: Ref<HTMLInputElement>
}

/**
 * Search-InConversation: a row under the conversation's header with the
 * field, where the viewer is among the matches, and steps through them.
 * Each step brings that match into view and marks it (ConversationRoom);
 * the caret stays in the field throughout, so typing, Enter and the arrow
 * keys all keep working.
 *
 * Keys: Enter or ↑ for the next older match, Shift+Enter or ↓ for the next
 * newer one, Esc to close.
 */
const ConversationSearchBar = ({ id, search, onClose, inputRef }: ConversationSearchBarProps) => {
  const { status, index, results, total, isTruncated } = search

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'ArrowUp') {
      event.preventDefault()
      search.older()
    } else if ((event.key === 'Enter' && event.shiftKey) || event.key === 'ArrowDown') {
      event.preventDefault()
      search.newer()
    }
  }

  // "3 of 12", or "3 of 50+" when there were more matches than came back.
  const position = `${index + 1} of ${results.length}${isTruncated ? '+' : ''}`

  let count: string | null = null
  let announcement = ''
  if (status === 'found') {
    count = position
    announcement = isTruncated
      ? `Match ${index + 1} of the newest ${results.length}, ${total} in all.`
      : `Match ${index + 1} of ${results.length}.`
  } else if (status === 'none') {
    count = 'No matches'
    announcement = 'No matches.'
  } else if (status === 'failed') {
    announcement = 'Search isn’t available right now.'
  } else if (search.text.trim().length === 1) {
    announcement = `Searches need at least ${MIN_CHARS} characters.`
  }

  return (
    <div id={id} className='convo-search' role='search' aria-label='In this conversation'>
      <div className='input-with-icon convo-search__field'>
        {status === 'searching' ? (
          <SignalBars state='connecting' className='convo-search__busy' />
        ) : (
          <Icon name='search' size={16} />
        )}
        {/* Opened on request, so the caret goes straight to it. */}
        <input
          ref={inputRef}
          autoFocus
          type='search'
          className='input'
          aria-label='Search in this conversation'
          placeholder='Search in this conversation'
          autoComplete='off'
          spellCheck={false}
          enterKeyHint='search'
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {count && (
        <span
          className={`convo-search__count${status === 'none' ? ' is-empty' : ''}`}
          title={isTruncated ? `${total} matches in all — the newest ${results.length} can be stepped through` : undefined}
        >
          {count}
        </span>
      )}

      {status === 'failed' && (
        <Tooltip label='Search isn’t available right now — try again'>
          <Button variant='ghost' icon aria-label='Try the search again' onClick={search.retry}>
            <Icon name='refresh' size={16} />
          </Button>
        </Tooltip>
      )}

      <Tooltip label='Older match (Enter)'>
        <Button variant='ghost' icon aria-label='Older match' disabled={!search.canGoOlder} onClick={search.older}>
          <Icon name='chevU' size={16} />
        </Button>
      </Tooltip>
      <Tooltip label='Newer match (Shift+Enter)'>
        <Button variant='ghost' icon aria-label='Newer match' disabled={!search.canGoNewer} onClick={search.newer}>
          <Icon name='chevD' size={16} />
        </Button>
      </Tooltip>
      <Tooltip label='Close search (Esc)'>
        <Button variant='ghost' icon aria-label='Close search' onClick={onClose}>
          <Icon name='x' size={16} />
        </Button>
      </Tooltip>

      <p className='sr-only' aria-live='polite'>
        {announcement}
      </p>
    </div>
  )
}

export default ConversationSearchBar
