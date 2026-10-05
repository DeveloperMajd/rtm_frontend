import { useState, type RefObject } from 'react'
import { reactionLabel } from '../../utils/reactions'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'
import type { ReactionType } from '../../utils/baseTypes'

type MessageReactionsProps = {
  /** Reactions grouped by emoji (see useMessageReactions). */
  grouped: Record<string, ReactionType[]>
  viewerId: string | undefined
  /** A left/read-only group: reactions stay visible but can't be changed. */
  readOnly: boolean
  onToggle: (reaction: string, reacted: boolean) => void
  /** Opens the picker from the add button at the end of the row. */
  onAdd: () => void
  addButtonRef: RefObject<HTMLButtonElement | null>
  /** Whether the picker is currently open from that add button. */
  isAdding: boolean
}

/**
 * The reaction pills under a bubble. Yours are outlined in the accent (and
 * pressed, for assistive tech); hovering or focusing a pill lists who
 * reacted. A pill added after the message first rendered pops in, once.
 */
const MessageReactions = ({
  grouped,
  viewerId,
  readOnly,
  onToggle,
  onAdd,
  addButtonRef,
  isAdding,
}: MessageReactionsProps) => {
  // Which emoji were already here when this message rendered — only pills
  // that appear later get the "just added" animation, not every pill in the
  // conversation each time it opens.
  const [initialReactions] = useState(() => new Set(Object.keys(grouped)))

  const entries = Object.entries(grouped)
  if (entries.length === 0) return null

  return (
    <div className='reactions'>
      {entries.map(([reaction, group]) => {
        const reactedByMe = group.some((r) => r.user.id === viewerId)
        const names = group.map((r) => (r.user.id === viewerId ? 'You' : r.user.name)).join(', ')
        const label = `${reactionLabel(reaction)}, ${group.length}`
        const className = [
          'reactions__pill',
          reactedByMe ? 'is-mine' : '',
          readOnly ? 'is-static' : '',
          initialReactions.has(reaction) ? '' : 'is-new',
        ]
          .filter(Boolean)
          .join(' ')

        const content = (
          <>
            <span aria-hidden='true'>{reaction}</span>
            <span className='reactions__count' aria-hidden='true'>
              {group.length}
            </span>
          </>
        )

        return (
          <Tooltip key={reaction} label={names}>
            {readOnly ? (
              <span role='img' aria-label={`${label}: ${names}`} className={className}>
                {content}
              </span>
            ) : (
              <button
                type='button'
                className={className}
                aria-label={label}
                aria-pressed={reactedByMe}
                onClick={() => onToggle(reaction, reactedByMe)}
              >
                {content}
              </button>
            )}
          </Tooltip>
        )
      })}

      {!readOnly && (
        <button
          ref={addButtonRef}
          type='button'
          className='reactions__add'
          aria-label='Add reaction'
          aria-haspopup='menu'
          aria-expanded={isAdding}
          onClick={onAdd}
        >
          <Icon name='smilePlus' size={14} />
        </button>
      )}
    </div>
  )
}

export default MessageReactions
