import { useEffect, useRef, useState } from 'react'
import { mdiEmoticonOutline } from '@mdi/js'
import useAuth from '../../hooks/useAuth'
import useMessageReactions from '../../hooks/useMessageReactions'
import { QUICK_REACTIONS } from '../../utils/reactions'
import Icon from '../ui/Icon'
import type { ReactionType } from '../../utils/baseTypes'

type ReactionTriggerProps = {
  messageId: string
  reactions: ReactionType[]
  /** Which side of the bubble to float on — the "inner" side (away from the
   * screen edge the bubble is pushed against), WhatsApp-style. */
  isOwn: boolean
}

/** The add-reaction affordance: a small button floating outside the bubble,
 * vertically centered on it, revealed on hover/focus. Positioned absolute
 * relative to `.bubble` so its vertical center tracks the bubble alone, not
 * the reaction pills rendered below it. */
const ReactionTrigger = ({ messageId, reactions, isOwn }: ReactionTriggerProps) => {
  const { user } = useAuth()
  const { grouped, toggleReaction } = useMessageReactions(messageId, reactions)
  const [pickerOpen, setPickerOpen] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Move focus into the picker when it opens, and give it back to the
  // trigger whenever it closes (Escape or a selection) instead of leaving
  // focus stranded on a button that just disappeared.
  useEffect(() => {
    if (pickerOpen) {
      pickerRef.current?.querySelector('button')?.focus()
    }
  }, [pickerOpen])

  const closePicker = () => {
    setPickerOpen(false)
    addButtonRef.current?.focus()
  }

  return (
    <div className={`reaction-trigger${isOwn ? ' is-own' : ' is-other'}`}>
      <button
        ref={addButtonRef}
        type='button'
        className='reaction-trigger__add'
        onClick={() => setPickerOpen((open) => !open)}
        aria-label='Add reaction'
        aria-expanded={pickerOpen}
      >
        <Icon path={mdiEmoticonOutline} />
      </button>
      {pickerOpen && (
        <div
          ref={pickerRef}
          className='reaction-trigger__picker'
          onKeyDown={(e) => e.key === 'Escape' && closePicker()}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type='button'
              onClick={() => {
                const reactedByMe = grouped[emoji]?.some((r) => r.user.id === user?.id) ?? false
                toggleReaction({ reaction: emoji, reacted: reactedByMe })
                closePicker()
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ReactionTrigger
