import { useQuery } from '@tanstack/react-query'
import { getAllConversations } from '../services/api/conversations'
import type { ConversationType } from '../utils/baseTypes'
import { sortConversations } from '../utils/conversations'

/**
 * The viewer's conversations, pinned first, then by recent activity. Kept
 * live by useUserChannel (subscribed once, by AppShell), presence included:
 * nothing polls.
 */
const useConversations = () => {
  const { data, isLoading, isFetchedAfterMount, error, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: getAllConversations,
    select: (response): ConversationType[] => sortConversations(response.data),
    // Opening a conversation reads unread_count from this cache to place the
    // unread divider, and that read happens once and is then frozen — so it
    // has to be a number this mount actually fetched. A cached count can be
    // out of date (nothing refreshes it on a timer), and the global
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
