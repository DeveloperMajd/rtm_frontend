import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { searchMessages } from '../../services/api/messages'

const MessageSearch = () => {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  const showResults = debouncedQuery.length >= 2

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['messages', 'search', debouncedQuery],
    queryFn: () => searchMessages(debouncedQuery),
    enabled: showResults,
  })

  const handleSelect = (conversationId: string) => {
    setQuery('')
    setDebouncedQuery('')
    navigate(`/conversations/${conversationId}`)
  }

  return (
    <div className='sidebar-search'>
      <input
        type='search'
        className='input'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search messages…'
        aria-label='Search messages'
      />

      {showResults && (
        <div className='search-results'>
          {isFetching ? (
            <p className='search-results__note'>Searching…</p>
          ) : results.length === 0 ? (
            <p className='search-results__note'>No messages found.</p>
          ) : (
            <ul>
              {results.map((result) => (
                <li key={result.id}>
                  <button type='button' onClick={() => handleSelect(result.conversation_id)}>
                    <div className='search-results__top'>
                      <span className='search-results__title'>
                        {result.conversation_title || 'Conversation'}
                      </span>
                      <time>
                        {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                      </time>
                    </div>
                    <p className='search-results__snippet truncate'>
                      <strong>{result.sender.name}: </strong>
                      {result.body}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default MessageSearch
