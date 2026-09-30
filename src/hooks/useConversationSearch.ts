import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CONVERSATION_SEARCH_LIMIT, searchConversation } from '../services/api/messages'
import { queryTerms } from '../utils/searchText'
import type { MessageSearchResultType } from '../utils/baseTypes'

export const MIN_CHARS = 2
const DEBOUNCE_MS = 300

export type ConversationSearchStatus = 'idle' | 'searching' | 'failed' | 'none' | 'found'

/**
 * Search within one conversation (Search-InConversation): what's typed,
 * the matches for it, newest first, and which one is being shown.
 *
 * Matches are numbered from the newest, the way the viewer meets them
 * coming up from the bottom of the conversation: "1 of 12" is the latest,
 * and each step back in time counts up. At most the newest 50 come back,
 * so a search with more than that can step through those 50 and says there
 * are more (`total`).
 */
export function useConversationSearch(conversationId: string, isOpen: boolean) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  const isSearching = isOpen && query.length >= MIN_CHARS
  const { data, isError, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['conversation-search', conversationId, query],
    queryFn: () => searchConversation(conversationId, query),
    enabled: isSearching,
    retry: 1,
    // New messages arrive all the time; a search run again should find them.
    staleTime: 0,
  })

  const results: MessageSearchResultType[] = isSearching ? (data?.results ?? []) : []
  const total = isSearching ? (data?.total ?? 0) : 0

  // Back to the newest match whenever a new set of matches comes in.
  // Adjusted during render (React's pattern for state that follows other
  // state), so the first match is shown along with the results themselves.
  const resultsKey = `${query}:${dataUpdatedAt}`
  const [indexFor, setIndexFor] = useState(resultsKey)
  const [index, setIndex] = useState(0)
  if (indexFor !== resultsKey) {
    setIndexFor(resultsKey)
    setIndex(0)
  }

  let status: ConversationSearchStatus = 'idle'
  if (isSearching) {
    if (isError) status = 'failed'
    else if (!data) status = 'searching'
    else status = results.length === 0 ? 'none' : 'found'
  }

  const current = status === 'found' ? (results[index] ?? null) : null

  return {
    text,
    setText,
    status,
    /** The words to mark in the messages. */
    terms: isSearching && status !== 'failed' ? queryTerms(query) : [],
    results,
    total,
    /** More matches than came back (see CONVERSATION_SEARCH_LIMIT). */
    isTruncated: total > results.length && results.length === CONVERSATION_SEARCH_LIMIT,
    index,
    current,
    canGoOlder: status === 'found' && index < results.length - 1,
    canGoNewer: status === 'found' && index > 0,
    older: () => setIndex((i) => Math.min(i + 1, results.length - 1)),
    newer: () => setIndex((i) => Math.max(i - 1, 0)),
    retry: () => void refetch(),
    reset: () => {
      setText('')
      setQuery('')
    },
  }
}

export type ConversationSearch = ReturnType<typeof useConversationSearch>
