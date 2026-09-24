import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import type { IconName } from '../ui/icons'

const ACTIONS: { icon: IconName; label: string }[] = [
  { icon: 'search', label: 'Search' },
  { icon: 'bellOff', label: 'Mute' },
  { icon: 'pin', label: 'Pin' },
]

/**
 * The info panel's quick actions — search this conversation, mute, pin.
 * None has an API behind it yet (Phase 2), so they're shown, disabled and
 * tagged, rather than left out or faked.
 */
const SoonActions = () => (
  <div className='soon-actions' role='group' aria-label='Conversation actions'>
    {ACTIONS.map(({ icon, label }) => (
      <button
        key={label}
        type='button'
        className='soon-actions__btn'
        disabled
        aria-label={`${label} (coming soon)`}
      >
        <Icon name={icon} size={18} />
        <span className='soon-actions__label'>
          {label}
          <Badge tone='soon'>Soon</Badge>
        </span>
      </button>
    ))}
  </div>
)

export default SoonActions
