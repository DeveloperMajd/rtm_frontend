import useAuth from '../../hooks/useAuth'
import useMessageReactions from '../../hooks/useMessageReactions'
import type { ReactionType } from '../../utils/baseTypes'

type MessageReactionsProps = {
  messageId: string
  reactions: ReactionType[]
}

/** The already-placed reaction pills, rendered below the bubble (not inside
 * it) — the add-reaction trigger itself is `ReactionTrigger`, floating
 * beside the bubble instead. */
const MessageReactions = ({ messageId, reactions }: MessageReactionsProps) => {
  const { user } = useAuth()
  const { grouped, toggleReaction } = useMessageReactions(messageId, reactions)

  if (Object.keys(grouped).length === 0) return null

  return (
    <div className='reactions'>
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
    </div>
  )
}

export default MessageReactions
