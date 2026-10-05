import { useQuery } from '@tanstack/react-query'
import { getAllConversations } from '../services/api/conversations'
import type { ConversationType } from '../utils/baseTypes'
import { sortConversations } from '../utils/conversations'

/**
 * The viewer's conversations, pinned first, then by recent activity. Kept
 * live by useUserChannel (subscribed once, by AppShell), and polled for
 * presence, which has no broadcast of its own.
 */
const useConversations = () => {
  const { data, isLoading, isFetchedAfterMount, error, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: getAllConversations,
    select: (response): ConversationType[] => sortConversations(response.data),
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

  return {
    conversations: data ?? [],
    isLoading,
    error: error as Error | null,
    retry: () => void refetch(),
    /** True once this mount has fetched its own copy of the list — see the
     * refetchOnMount note above, and useUnreadSnapshot. */
    isReady: isFetchedAfterMount,
  }
}

export default useConversations
