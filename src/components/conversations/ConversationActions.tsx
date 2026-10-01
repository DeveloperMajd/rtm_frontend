import type { ConversationType } from '../../utils/baseTypes'
import useConversationPreferences from '../../hooks/useConversationPreferences'
import Icon from '../ui/Icon'
import type { IconName } from '../ui/icons'

interface ConversationActionsProps {
  conversation: ConversationType
  /** Opens the search bar in the conversation (Search-InConversation). */
  onSearch?: () => void
}

/**
 * The info panel's quick actions: search this conversation, and the
 * viewer's own mute, pin and archive. On a phone this is where they live —
 * the list's hover actions aren't there on a touch screen.
 *
 * A group the viewer has left keeps Search and Archive: there's history
 * to look through and a list to tidy, but nothing new to pin or mute.
 */
const ConversationActions = ({ conversation: c, onSearch }: ConversationActionsProps) => {
  const changePreferences = useConversationPreferences()
  const left = Boolean(c.viewer_left_at)
  const muted = Boolean(c.muted_at)
  const pinned = Boolean(c.pinned_at)
  const archived = Boolean(c.archived_at)

  const actions: {
    key: string
    icon: IconName
    label: string
    /** Switched on — shown, and said by the label itself ("Unmute"). */
    on?: boolean
    onClick: () => void
  }[] = []

  if (onSearch) actions.push({ key: 'search', icon: 'search', label: 'Search', onClick: onSearch })
  if (!left) {
    actions.push({
      key: 'mute',
      icon: muted ? 'bell' : 'bellOff',
      label: muted ? 'Unmute' : 'Mute',
      on: muted,
      onClick: () => changePreferences(c, { muted: !muted }),
    })
    if (!archived) {
      actions.push({
        key: 'pin',
        icon: 'pin',
        label: pinned ? 'Unpin' : 'Pin',
        on: pinned,
        onClick: () => changePreferences(c, { pinned: !pinned }),
      })
    }
  }
  actions.push({
    key: 'archive',
    icon: 'archive',
    label: archived ? 'Unarchive' : 'Archive',
    onClick: () => changePreferences(c, { archived: !archived }),
  })

  return (
    <div
      className='conversation-actions'
      role='group'
      aria-label='Conversation actions'
      style={{ gridTemplateColumns: `repeat(${actions.length}, 1fr)` }}
    >
      {actions.map(({ key, icon, label, on, onClick }) => (
        <button key={key} type='button' className={`conversation-actions__btn${on ? ' is-on' : ''}`} onClick={onClick}>
          <Icon name={icon} size={18} />
          <span className='conversation-actions__label'>{label}</span>
        </button>
      ))}
    </div>
  )
}

export default ConversationActions
