import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { addReaction, removeReaction } from '../services/api/messages'
import type { ReactionType } from '../utils/baseTypes'

/** Shared by the reaction pills (below the bubble) and the add-reaction
 * trigger (floating beside it) — both need the same grouping and the same
 * toggle mutation, just rendered in two different places. */
const useMessageReactions = (messageId: string, reactions: ReactionType[]) => {
  const { mutate: toggleReaction } = useMutation({
    mutationFn: ({ reaction, reacted }: { reaction: string; reacted: boolean }) =>
      reacted ? removeReaction(messageId, reaction) : addReaction(messageId, reaction),
    onError: () => toast.error('Failed to update reaction. Please try again.'),
  })

  const grouped: Record<string, ReactionType[]> = {}
  for (const reaction of reactions) {
    if (!grouped[reaction.reaction]) grouped[reaction.reaction] = []
    grouped[reaction.reaction].push(reaction)
  }

  return { grouped, toggleReaction }
}

export default useMessageReactions
