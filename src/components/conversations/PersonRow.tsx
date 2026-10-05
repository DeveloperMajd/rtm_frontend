import type { ReactNode } from 'react'
import Avatar from '../ui/Avatar'
import { presenceLabel } from '../../utils/presence'

interface PersonRowProps {
  name: string
  avatarUrl?: string | null
  isOnline?: boolean
  lastSeenAt?: string | null
  /** Overrides the presence line, e.g. "You · Online". */
  meta?: ReactNode
  /** Leading control (a checkbox or radio) — makes the row a <label> for it. */
  control?: ReactNode
  /** Trailing content: a badge, an Add button, a menu. */
  trailing?: ReactNode
  selected?: boolean
}

/**
 * One person in a dialog or panel list: avatar with presence, name, a
 * presence line, and an optional control either side. With a leading
 * control the whole row is its label, so the name is a click target too.
 */
const PersonRow = ({
  name,
  avatarUrl,
  isOnline,
  lastSeenAt,
  meta,
  control,
  trailing,
  selected = false,
}: PersonRowProps) => {
  const className = `person-row${control ? ' is-selectable' : ''}${selected ? ' is-selected' : ''}`
  const content = (
    <>
      {control}
      <Avatar name={name} src={avatarUrl} size='sm' online={isOnline ?? false} />
      <span className='person-row__text'>
        <span className='person-row__name'>{name}</span>
        <span className={`person-row__meta${isOnline && meta === undefined ? ' is-online' : ''}`}>
          {meta ?? presenceLabel(isOnline, lastSeenAt)}
        </span>
      </span>
      {trailing}
    </>
  )

  return control ? <label className={className}>{content}</label> : <div className={className}>{content}</div>
}

export default PersonRow
