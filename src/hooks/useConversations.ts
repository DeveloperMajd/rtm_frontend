import { useQuery } from '@tanstack/react-query'
import { getAllConversations } from '../services/api/conversations'
import type { ConversationType } from '../utils/baseTypes'

const useConversations = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: getAllConversations,
    select: (response): ConversationType[] => response.data,
  })

  return {
    conversations: data ?? [],
    isLoading,
    error: error as Error | null,
  }
}

export default useConversations
