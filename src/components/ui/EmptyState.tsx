import type { ReactNode } from 'react'
import Icon from './Icon'
import type { IconName } from './icons'

interface EmptyStateProps {
  icon: IconName
  title: string
  /** A sentence or two: why it's empty, or what went wrong. */
  children?: ReactNode
  /** Buttons — the way out of the state, when there is one. */
  actions?: ReactNode
  /** `danger` for a failure (couldn't load), neutral otherwise. */
  tone?: 'neutral' | 'danger'
  className?: string
}

/**
 * States-Empty / States-Errors: an icon tile, a title, a line saying what
 * this is, and what to do about it. A status region, so a state reached
 * by filtering or retrying is announced as well as shown.
 */
const EmptyState = ({ icon, title, children, actions, tone = 'neutral', className = '' }: EmptyStateProps) => (
  <div className={`empty ${className}`.trim()} role='status'>
    <span className={`empty__icon${tone === 'danger' ? ' is-danger' : ''}`} aria-hidden='true'>
      <Icon name={icon} size={22} />
    </span>
    <h2 className='empty__title'>{title}</h2>
    {children && <p className='empty__text'>{children}</p>}
    {actions && <div className='empty__actions'>{actions}</div>}
  </div>
)

export default EmptyState
