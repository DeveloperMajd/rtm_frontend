import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getReadPointers, type ReadPointer } from '../services/api/conversations'
import { readPointersKey } from '../utils/readReceipts'

const NONE: ReadPointer[] = []

/** Not worth retrying: they're not in the conversation (a link into someone
 * else's), or not any more, and asking again won't change that. */
const isRefused = (error: unknown) =>
  isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 404)

/**
 * How far everyone still in a conversation has read. Fetched as the room
 * opens and kept current by the ConversationRead broadcasts useMessages
 * listens for on the conversation's channel (see applyReadPointer).
 *
 * `enabled: false` for a conversation the viewer has left, whose receipts
 * aren't theirs to see any more (the endpoint refuses them).
 */
export default function useReadPointers(conversationId: string, enabled: boolean): ReadPointer[] {
  const { data } = useQuery({
    queryKey: readPointersKey(conversationId),
    queryFn: () => getReadPointers(conversationId),
    enabled,
    retry: (failureCount, error) => !isRefused(error) && failureCount < 1,
    // Only as current as the broadcasts since it was fetched, and the room
    // wasn't listening while it was closed.
    staleTime: 0,
  })
  return enabled ? (data ?? NONE) : NONE
}
