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
    <div className='relative px-4 pt-3'>
      <input
        type='search'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search messages...'
        className='w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
      />

      {showResults && (
        <div className='absolute left-4 right-4 mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-72 overflow-y-auto z-10'>
          {isFetching ? (
            <p className='text-sm text-gray-400 px-3 py-2'>Searching…</p>
          ) : results.length === 0 ? (
            <p className='text-sm text-gray-400 px-3 py-2'>No messages found.</p>
          ) : (
            <ul className='divide-y divide-gray-100'>
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type='button'
                    onClick={() => handleSelect(result.conversation_id)}
                    className='w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer'
                  >
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-medium text-gray-800'>
                        {result.conversation_title || 'Conversation'}
                      </span>
                      <time className='text-xs text-gray-400 ml-2 shrink-0'>
                        {formatDistanceToNow(new Date(result.created_at), { includeSeconds: true }) + ' ago'}
                      </time>
                    </div>
                    <p className='text-sm text-gray-600 truncate'>
                      <span className='font-medium'>{result.sender.name}: </span>
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
