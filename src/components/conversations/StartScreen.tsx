import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import BrandMark from '../ui/BrandMark'
import type { IconName } from '../ui/icons'
import { IS_MAC_LIKE } from '../../utils/clipboard'

interface StartScreenProps {
  /** No conversations at all yet — a first visit. */
  isNewAccount: boolean
  firstName: string
  onNewConversation: () => void
  onAddContact: () => void
  onNewGroup: () => void
  onSearch: () => void
}

type Step = { icon: IconName; title: string; text: string; action: React.ReactNode }

/**
 * What sits beside the list with no conversation open (from 768px; a phone
 * shows the list alone). Desktop-1440-NoSelection: a way into a chat. For a
 * brand-new account, Desktop-1440-FirstRun: three first steps instead.
 */
const StartScreen = ({
  isNewAccount,
  firstName,
  onNewConversation,
  onAddContact,
  onNewGroup,
  onSearch,
}: StartScreenProps) => {
  if (isNewAccount) {
    const steps: Step[] = [
      {
        icon: 'userPlus',
        title: 'Add a contact',
        text: 'Find someone by name or email and start a direct chat.',
        action: (
          <Button variant='secondary' className='sm' onClick={onAddContact}>
            Add contact
          </Button>
        ),
      },
      {
        icon: 'users',
        title: 'Create a group',
        text: 'Bring several people together, with admins.',
        action: (
          <Button variant='secondary' className='sm' onClick={onNewGroup}>
            New group
          </Button>
        ),
      },
      {
        icon: 'user',
        title: 'Finish your profile',
        text: 'Add a photo and a short bio so people know you.',
        action: (
          <Link to='/profile' className='btn secondary sm'>
            Edit profile
          </Link>
        ),
      },
    ]

    return (
      <div className='room room--start'>
        <div className='welcome'>
          <p className='welcome__eyebrow'>
            <BrandMark size={40} withWordmark={false} />
            Welcome
          </p>
          <h2 className='welcome__title'>Welcome to RTM, {firstName}</h2>
          <p className='welcome__text'>
            Real-time messaging with live presence and typing. Three quick things to get going.
          </p>
          <ul className='welcome__steps'>
            {steps.map((step) => (
              <li key={step.title} className='welcome__step'>
                <span className='welcome__step-icon' aria-hidden='true'>
                  <Icon name={step.icon} size={20} />
                </span>
                <div>
                  <h3 className='welcome__step-title'>{step.title}</h3>
                  <p className='welcome__step-text'>{step.text}</p>
                </div>
                <div className='welcome__step-action'>{step.action}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className='room room--start'>
      <div className='empty'>
        <span className='empty__icon' aria-hidden='true'>
          <Icon name='chatDots' size={22} />
        </span>
        <h2 className='empty__title'>Pick up where you left off</h2>
        <p className='empty__text'>Choose a conversation from the list, or start a new one.</p>
        <div className='empty__actions'>
          <Button className='sm' aria-haspopup='dialog' onClick={onNewConversation}>
            <Icon name='plus' size={14} />
            New conversation
          </Button>
          <Button variant='secondary' className='sm' aria-haspopup='dialog' onClick={onSearch}>
            <Icon name='search' size={14} />
            Search
          </Button>
        </div>
        <p className='start-hint' aria-hidden='true'>
          Jump anywhere with <kbd>{IS_MAC_LIKE ? '⌘' : 'Ctrl'}</kbd> <kbd>K</kbd>
        </p>
      </div>
    </div>
  )
}

export default StartScreen
