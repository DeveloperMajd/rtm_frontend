import { useQuery } from '@tanstack/react-query'
import { getMessageInfo } from '../services/api/messages'
import { messageInfoKey } from '../utils/readReceipts'

/**
 * Who has seen one of the viewer's messages, and who hasn't yet: fetched
 * when its info opens, because the server is what applies the read-receipt
 * rules (a viewer who shares nothing gets no lists; see
 * MessageController::info).
 *
 * Kept current while it's open: a live ConversationRead refetches it (see
 * useMessages). It's never reused as it was — the lists were only true when
 * they were fetched.
 */
export default function useMessageInfo(conversationId: string, messageId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...messageInfoKey(conversationId), messageId],
    queryFn: () => getMessageInfo(messageId),
    enabled,
    staleTime: 0,
  })
}
