import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchMessages } from '../../services/api/messages'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { loadRecentSearches, rememberSearch } from '../../utils/recentSearches'
import { highlightSegments, queryTerms, resultTime, snippetAround } from '../../utils/searchText'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import SignalBars from '../ui/SignalBars'
import type { ConversationType, MessageSearchResultType } from '../../utils/baseTypes'

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  /** The viewer's conversations (already loaded by the shell) — for the
   * "Jump to" list and to put a face on each result group. */
  conversations: ConversationType[]
}

const MIN_CHARS = 2
const DEBOUNCE_MS = 300
const JUMP_TO_COUNT = 5
// The API returns at most this many rows, best first, with no paging.
const API_LIMIT = 20

type Option =
  | { kind: 'recent'; query: string }
  | { kind: 'jump'; conversation: ConversationType }
  | { kind: 'result'; result: MessageSearchResultType }

/**
 * ⌘K message search (Search-Palette-Results / -States). Opened with no query
 * it offers recent searches and a few conversations to jump to; from two
 * characters it searches every conversation, results grouped by
 * conversation with the matching words marked.
 *
 * Opening a result opens its conversation — jumping to the message itself
 * needs a message-context endpoint (Phase 2). The "This conversation" scope
 * is shown, disabled and tagged, for the same reason.
 *
 * A combobox: focus stays in the field while ↑/↓ move through the options
 * (aria-activedescendant) and ↵ opens one. Modal, with Esc to close.
 */
const SearchPalette = (props: SearchPaletteProps) => (props.open ? <PaletteDialog {...props} /> : null)

const PaletteDialog = ({ onClose, conversations }: SearchPaletteProps) => {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const optionId = (index: number) => `${listboxId}-option-${index}`

  useModalBehavior({
    open: true,
    containerRef: dialogRef,
    onClose,
    getInitialFocus: () => inputRef.current,
  })

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [recent, setRecent] = useState(loadRecentSearches)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const isSearching = debouncedQuery.length >= MIN_CHARS
  const { data: results = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['messages', 'search', debouncedQuery],
    queryFn: () => searchMessages(debouncedQuery),
    enabled: isSearching,
    retry: 1,
  })
  const terms = queryTerms(debouncedQuery)

  // Results grouped by conversation, groups in the order of their best
  // match (the API ranks by relevance, not by conversation).
  const groups: { id: string; results: MessageSearchResultType[] }[] = []
  for (const r of results) {
    const group = groups.find((g) => g.id === r.conversation_id)
    if (group) group.results.push(r)
    else groups.push({ id: r.conversation_id, results: [r] })
  }

  // --- The options ↑/↓ move through, in on-screen order ---
  // Built from the groups, not the ranked list: grouping moves results
  // around, and the arrow keys must follow what's on screen.
  const jumpTo = conversations.slice(0, JUMP_TO_COUNT)
  let options: Option[]
  if (!isSearching) {
    options = [
      ...recent.map((q): Option => ({ kind: 'recent', query: q })),
      ...jumpTo.map((c): Option => ({ kind: 'jump', conversation: c })),
    ]
  } else if (isLoading || isError) {
    options = []
  } else {
    options = groups.flatMap((g) => g.results.map((r): Option => ({ kind: 'result', result: r })))
  }

  // Back to the first option whenever the list itself changes. Adjusted
  // during render (React's pattern for state that follows other state).
  const optionsKey = `${isSearching}:${debouncedQuery}:${isLoading}:${options.length}`
  const [activeFor, setActiveFor] = useState(optionsKey)
  const [activeIndex, setActiveIndex] = useState(0)
  if (activeFor !== optionsKey) {
    setActiveFor(optionsKey)
    setActiveIndex(0)
  }

  useEffect(() => {
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, listboxId])

  const openConversation = (conversationId: string) => {
    onClose()
    navigate(`/conversations/${conversationId}`)
  }

  const activate = (option: Option | undefined) => {
    if (!option) return
    if (option.kind === 'recent') {
      setQuery(option.query)
      setDebouncedQuery(option.query)
      inputRef.current?.focus()
    } else if (option.kind === 'jump') {
      openConversation(option.conversation.id)
    } else {
      // Only searches that led somewhere are worth offering again.
      setRecent(rememberSearch(debouncedQuery))
      openConversation(option.result.conversation_id)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (options.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((i) => (i + step + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      activate(options[activeIndex])
    }
  }

  const conversationFor = (id: string) => conversations.find((c) => c.id === id)

  // --- Rendering ---
  const optionProps = (index: number) => ({
    id: optionId(index),
    role: 'option' as const,
    'aria-selected': index === activeIndex,
    className: `palette__option${index === activeIndex ? ' is-active' : ''}`,
    // Keep focus in the field; the option is chosen on click.
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onMouseMove: () => index !== activeIndex && setActiveIndex(index),
    onClick: () => activate(options[index]),
  })

  const enterHint = (
    <kbd className='palette__enter' aria-hidden='true'>
      ↵
    </kbd>
  )

  let body: ReactNode
  let status = query.trim().length === 1 ? `Searches need at least ${MIN_CHARS} characters.` : ''
  if (!isSearching) {
    body = (
      <>
        {recent.length > 0 && (
          <div role='group' aria-labelledby={`${listboxId}-recent`}>
            <div id={`${listboxId}-recent`} className='palette__section'>
              Recent searches
            </div>
            {recent.map((q, i) => (
              <div key={q} {...optionProps(i)}>
                <Icon name='history' size={16} className='palette__option-icon' />
                <span className='palette__option-label'>{q}</span>
                {enterHint}
              </div>
            ))}
          </div>
        )}
        {jumpTo.length > 0 && (
          <div role='group' aria-labelledby={`${listboxId}-jump`}>
            <div id={`${listboxId}-jump`} className='palette__section'>
              Jump to
            </div>
            {jumpTo.map((c, i) => {
              const index = recent.length + i
              return (
                <div key={c.id} {...optionProps(index)}>
                  <ConversationAvatar conversation={c} />
                  <span className='palette__option-label'>{conversationTitle(c)}</span>
                  <span className='palette__option-meta'>{conversationMeta(c)}</span>
                  {enterHint}
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  } else if (isLoading) {
    status = 'Searching…'
    body = (
      <div className='palette__skeleton' aria-hidden='true'>
        {[0, 1, 2].map((i) => (
          <div key={i} className='palette__skeleton-row'>
            <span className='skeleton skeleton--circle' />
            <span className='palette__skeleton-lines'>
              <span className='skeleton skeleton--text' style={{ width: '22%' }} />
              <span className='skeleton skeleton--text' style={{ width: i === 2 ? '55%' : '80%' }} />
            </span>
          </div>
        ))}
      </div>
    )
  } else if (isError) {
    status = 'Search isn’t available right now.'
    body = (
      <div className='palette__state'>
        <span className='palette__state-icon is-danger'>
          <Icon name='alert' size={20} />
        </span>
        <p className='palette__state-title'>Search isn’t available right now</p>
        <p className='palette__state-text'>
          We couldn’t reach the server. Your query is kept — try again in a moment.
        </p>
        <button type='button' className='palette__retry' onClick={() => void refetch()}>
          <Icon name='refresh' size={14} />
          Try again
        </button>
      </div>
    )
  } else if (results.length === 0) {
    status = 'No results.'
    body = (
      <div className='palette__state'>
        <span className='palette__state-icon'>
          <Icon name='search' size={20} />
        </span>
        <p className='palette__state-title'>No messages match “{debouncedQuery}”</p>
        <p className='palette__state-text'>
          Search matches whole words in your conversations. Try fewer or different words.
        </p>
        <p className='palette__state-note'>Searches need at least {MIN_CHARS} characters.</p>
      </div>
    )
  } else {
    status = results.length >= API_LIMIT ? `Top ${API_LIMIT} results.` : `${results.length} results.`

    let index = 0
    body = groups.map((group) => {
      const conversation = conversationFor(group.id)
      const title = group.results[0].conversation_title || (conversation && conversationTitle(conversation)) || 'Conversation'
      const headerId = `${listboxId}-group-${group.id}`
      const items = group.results.map((result) => ({ result, index: index++ }))
      return (
        <div key={group.id} role='group' aria-labelledby={headerId}>
          <div id={headerId} className='palette__group'>
            {conversation ? <ConversationAvatar conversation={conversation} /> : null}
            <span className='palette__group-title'>{title}</span>
            <span className='palette__group-count'>
              {group.results.length} {group.results.length === 1 ? 'match' : 'matches'}
            </span>
          </div>
          {items.map(({ result, index }) => (
            <div key={result.id} {...optionProps(index)}>
              <Avatar name={result.sender.name} src={result.sender.avatar_url} size='xs' />
              <span className='palette__result'>
                <span className='palette__result-top'>
                  <span className='palette__result-sender'>{result.sender.name}</span>
                  <time dateTime={result.created_at}>{resultTime(result.created_at)}</time>
                </span>
                <span className='palette__result-text'>
                  {highlightSegments(snippetAround(result.body, terms), terms).map((segment, i) =>
                    segment.match ? <mark key={i}>{segment.text}</mark> : <Fragment key={i}>{segment.text}</Fragment>,
                  )}
                </span>
              </span>
              {enterHint}
            </div>
          ))}
        </div>
      )
    })
  }

  const footRight = isSearching && !isLoading && !isError && results.length > 0
    ? results.length >= API_LIMIT
      ? `Top ${API_LIMIT} results`
      : `${results.length} ${results.length === 1 ? 'result' : 'results'}`
    : 'Full-text · 2+ chars'

  return createPortal(
    <div
      className='palette-overlay'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} className='palette' role='dialog' aria-modal='true' aria-label='Search messages'>
        <div className='palette__field'>
          <span className='palette__field-icon' aria-hidden='true'>
            {isSearching && isLoading ? <SignalBars state='connecting' /> : <Icon name='search' size={18} />}
          </span>
          <input
            ref={inputRef}
            className='palette__input'
            type='text'
            role='combobox'
            aria-label='Search messages'
            aria-expanded='true'
            aria-controls={listboxId}
            aria-autocomplete='list'
            aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
            placeholder='Search messages'
            autoComplete='off'
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className='palette__esc' aria-hidden='true'>
            Esc
          </kbd>
        </div>

        <div className='palette__scopes' role='group' aria-label='Search in'>
          <button type='button' className='chip' aria-pressed='true'>
            <Icon name='globe' size={14} />
            Everywhere
          </button>
          <button type='button' className='chip' disabled aria-label='This conversation (coming soon)'>
            <Icon name='chat' size={14} />
            This conversation
            <Badge tone='soon'>Soon</Badge>
          </button>
        </div>

        <div id={listboxId} className='palette__list scroll-y' role='listbox' aria-label='Search results'>
          {body}
        </div>

        <div className='palette__foot'>
          <span className='palette__keys' aria-hidden='true'>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate <kbd>↵</kbd> open <kbd>Esc</kbd> close
          </span>
          <span className='palette__foot-note'>{footRight}</span>
        </div>

        <div className='sr-only' aria-live='polite'>
          {status}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function conversationTitle(c: ConversationType): string {
  return c.type === 'group' ? c.title || 'Untitled group' : c.other_participant?.name || 'Direct conversation'
}

function conversationMeta(c: ConversationType): string {
  if (c.type === 'group') {
    const members = (c.participants ?? []).filter((p) => !p.left_at).length
    return members > 0 ? `${members} ${members === 1 ? 'member' : 'members'}` : ''
  }
  return c.other_participant?.is_online ? 'Online' : ''
}

const ConversationAvatar = ({ conversation }: { conversation: ConversationType }) => (
  <Avatar
    name={conversationTitle(conversation)}
    src={conversation.type === 'group' ? null : conversation.other_participant?.avatar_url}
    kind={conversation.type === 'group' ? 'group' : 'user'}
    size='xs'
  />
)

export default SearchPalette
