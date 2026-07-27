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

  return (
    <div className='reactions flex items-center gap-1 mt-1'>
      {Object.entries(grouped).map(([reaction, group]) => {
        const reactedByMe = group.some((r) => r.user.id === user?.id)
        return (
          <button
            key={reaction}
            type='button'
            onClick={() => toggleReaction({ reaction, reacted: reactedByMe })}
            className={`reaction-pill text-xs rounded-full border px-2 py-0.5 ${
              reactedByMe ? 'bg-blue-100 border-blue-400' : 'bg-gray-50 border-gray-300'
            }`}
          >
            {reaction} {group.length}
          </button>
        )
      })}

      <div className='relative'>
        <button
          type='button'
          onClick={() => setPickerOpen((open) => !open)}
          className='add-reaction opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-gray-600 px-1'
        >
          + 🙂
        </button>
        {pickerOpen && (
          <div className='absolute bottom-full mb-1 left-0 flex gap-1 bg-white border border-gray-300 rounded shadow p-1 z-10'>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type='button'
                onClick={() => {
                  const reactedByMe = grouped[emoji]?.some((r) => r.user.id === user?.id) ?? false
                  toggleReaction({ reaction: emoji, reacted: reactedByMe })
                  setPickerOpen(false)
                }}
                className='hover:bg-gray-100 rounded px-1'
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
