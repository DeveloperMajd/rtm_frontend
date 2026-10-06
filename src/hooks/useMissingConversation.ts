import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getConversationById } from '../services/api/conversations'

/** Why a conversation the viewer opened isn't one of theirs. */
export type MissingConversation = 'checking' | 'not-a-member' | 'unavailable'

/**
 * For a conversation that isn't in the viewer's list — a shared link is the
 * usual way to land on one — asks the conversation itself why not: they're
 * not in it (the server answers 403), or it's gone or never was (404, or
 * anything else). Asked only then, once; null while the conversation is
 * theirs.
 */
export default function useMissingConversation(conversationId: string, isMissing: boolean): MissingConversation | null {
  const { error, isPending } = useQuery({
    queryKey: ['conversation-access', conversationId],
    queryFn: () => getConversationById(conversationId),
    enabled: isMissing,
    retry: false,
    staleTime: 0,
  })

  if (!isMissing) return null
  if (isPending) return 'checking'
  return isAxiosError(error) && error.response?.status === 403 ? 'not-a-member' : 'unavailable'
}
