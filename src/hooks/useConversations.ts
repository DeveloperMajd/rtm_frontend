import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllConversations } from '../services/api/conversations'
import type { ConversationType, MessageType } from '../utils/baseTypes'
import { sortByRecency } from '../utils/conversations'
import useEcho from './useEcho'
import useAuth from './useAuth'

const useConversations = () => {
  const echo = useEcho()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()

  const { data, isLoading, isFetchedAfterMount, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: getAllConversations,
    select: (response): ConversationType[] => sortByRecency(response.data),
    // Online status has no realtime push (it's a Redis TTL heartbeat, not a
    // broadcast event), so poll at the same cadence as the heartbeat itself.
    refetchInterval: 15000,
    // Opening a conversation reads unread_count from this cache to place the
    // unread divider, and that read happens once and is then frozen — so it
    // has to be a number this mount actually fetched. While the room was
    // closed nothing here was polling (the interval only runs while mounted),
    // so a cached count can be arbitrarily out of date, and the global
    // staleTime would suppress the refetch that would have corrected it.
    refetchOnMount: 'always',
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
      .listen('ConversationParticipantsUpdated', () => {
        // Membership changes rarely fire and the payload doesn't carry
        // every field ConversationType needs (last_message_at, unread_count,
        // etc.), so refetching is simpler and safer than patching the cache
        // in place — unlike messages, this isn't latency-sensitive.
        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
      .listen('ConversationDeleted', () => {
        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })

    return () => {
      channel.stopListening('MessageSent')
      channel.stopListening('ConversationParticipantsUpdated')
      channel.stopListening('ConversationDeleted')
      echo.leave(`App.Models.User.${user.id}`)
    }
  }, [user, echo, queryClient])

  return {
    conversations: data ?? [],
    isLoading,
    error: error as Error | null,
    /** True once this mount has fetched its own copy of the list — see the
     * refetchOnMount note above, and useUnreadSnapshot. */
    isReady: isFetchedAfterMount,
  }
}

export default useConversations
