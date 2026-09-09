import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { addReaction, removeReaction } from '../../services/api/messages'
import { QUICK_REACTIONS } from '../../utils/reactions'
import useAuth from '../../hooks/useAuth'
import type { ReactionType } from '../../utils/baseTypes'

type MessageReactionsProps = {
  messageId: string
  reactions: ReactionType[]
}

const MessageReactions = ({ messageId, reactions }: MessageReactionsProps) => {
  const { user } = useAuth()
  const [pickerOpen, setPickerOpen] = useState(false)

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

  const hasReactions = Object.keys(grouped).length > 0

  return (
    <div className={`reactions${hasReactions ? '' : ' reactions--empty'}`}>
      {Object.entries(grouped).map(([reaction, group]) => {
        const reactedByMe = group.some((r) => r.user.id === user?.id)
        return (
          <button
            key={reaction}
            type='button'
            className={`reactions__pill${reactedByMe ? ' is-mine' : ''}`}
            onClick={() => toggleReaction({ reaction, reacted: reactedByMe })}
          >
            {reaction} {group.length}
          </button>
        )
      })}

      <div className='reactions__picker-wrap'>
        <button
          type='button'
          className='reactions__add'
          onClick={() => setPickerOpen((open) => !open)}
          aria-label='Add reaction'
          aria-expanded={pickerOpen}
        >
          + 🙂
        </button>
        {pickerOpen && (
          <div
            className='reactions__picker'
            onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type='button'
                onClick={() => {
                  const reactedByMe = grouped[emoji]?.some((r) => r.user.id === user?.id) ?? false
                  toggleReaction({ reaction: emoji, reacted: reactedByMe })
                  setPickerOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageReactions
