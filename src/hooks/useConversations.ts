import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllConversations } from '../services/api/conversations'
import type { ConversationType, MessageType } from '../utils/baseTypes'
import useEcho from './useEcho'
import useAuth from './useAuth'

const useConversations = () => {
  const echo = useEcho()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()

  const { data, isLoading, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: getAllConversations,
    select: (response): ConversationType[] => response.data,
  })

  // Tracked via a ref (not an effect dependency) so the channel subscription
  // below doesn't tear down and reconnect on every navigation.
  const openConversationIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    openConversationIdRef.current = location.pathname.match(/^\/conversations\/([^/]+)/)?.[1]
  }, [location.pathname])

  useEffect(() => {
    if (!user) return

    const channel = echo
      .private(`App.Models.User.${user.id}`)
      .listen('MessageSent', (message: MessageType) => {
        // The open conversation's own subscription (useMessages) already
        // owns this entry's cache updates, including the read receipt.
        // Refetching here too would race with that and could clobber the
        // just-marked-read unread_count back to a stale non-zero value.
        if (message.conversation_id === openConversationIdRef.current) return

        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })

    return () => {
      channel.stopListening('MessageSent')
      echo.leave(`App.Models.User.${user.id}`)
    }
  }, [user, echo, queryClient])

  return {
    conversations: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}

export default useConversations
