import { useState } from 'react'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** Shape-coded presence, matching Signal's DS-Icons-Avatars: online is
 * filled, offline is a hollow ring, away is half-filled, connecting is a
 * dashed ring — shape carries the meaning, colour only reinforces it. */
type Presence = 'online' | 'offline' | 'away' | 'connecting'

interface AvatarProps {
  name: string
  src?: string | null
  size?: Size
  /** 'group' renders a neutral group glyph instead of initials */
  kind?: 'user' | 'group'
  /** Legacy boolean form — true/false map to 'online'/'offline'. Kept
   * because most call sites only ever distinguish those two; prefer
   * `status` for 'away' or 'connecting'. undefined (on either prop) = no
   * presence dot at all. */
  online?: boolean
  /** Takes precedence over `online` when both are given. */
  status?: Presence
  className?: string
}

function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * User / group avatar: image when available, initials (or a group glyph)
 * fallback otherwise, with an optional presence dot.
 */
const Avatar = ({ name, src, size = 'sm', kind = 'user', online, status, className = '' }: AvatarProps) => {
  const [failed, setFailed] = useState(false)
  const showImg = Boolean(src) && !failed
  const presence: Presence | undefined = status ?? (online === undefined ? undefined : online ? 'online' : 'offline')

  return (
    <span
      className={`avatar avatar--${size}${kind === 'group' ? ' avatar--group' : ''} ${className}`.trim()}
      role='img'
      aria-label={name}
      title={name}
    >
      {/* The circular clip has to live on this inner wrapper, not the root —
          the status dot below is positioned half outside the circle on
          purpose, and a clip on the root would cut it into a crescent. */}
      <span className='avatar__clip'>
        {showImg ? (
          <img
            className='avatar__img'
            src={src as string}
            alt=''
            loading='lazy'
            decoding='async'
            onError={() => setFailed(true)}
          />
        ) : kind === 'group' ? (
          <svg viewBox='0 0 24 24' width='58%' height='58%' aria-hidden='true' fill='currentColor'>
            <path d='M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 2c-2.7 0-6 1.34-6 4v2h9v-2c0-1.03.4-1.94 1.06-2.7A10.9 10.9 0 0 0 8 13Zm8 0c-.35 0-.74.02-1.15.06.72.78 1.15 1.73 1.15 2.94v2h6v-2c0-2.66-3.3-4-6-4Z' />
          </svg>
        ) : (
          <span aria-hidden='true'>{initials(name)}</span>
        )}
      </span>
      {presence !== undefined && (
        <span className={`avatar__status is-${presence}`} aria-hidden='true' />
      )}
    </span>
  )
}

export default Avatar
