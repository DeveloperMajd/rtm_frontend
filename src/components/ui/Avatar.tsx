import { useState } from 'react'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  name: string
  src?: string | null
  size?: Size
  /** undefined = don't render a presence dot at all */
  online?: boolean
  className?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * User avatar: image when available, initials fallback otherwise, with an
 * optional presence dot. Used everywhere a person is shown.
 */
const Avatar = ({ name, src, size = 'sm', online, className = '' }: AvatarProps) => {
  const [failed, setFailed] = useState(false)
  const showImg = Boolean(src) && !failed

  return (
    <span
      className={`avatar avatar--${size} ${className}`.trim()}
      role='img'
      aria-label={name}
      title={name}
    >
      {showImg ? (
        <img
          className='avatar__img'
          src={src as string}
          alt=''
          loading='lazy'
          decoding='async'
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden='true'>{initials(name)}</span>
      )}
      {online !== undefined && (
        <span
          className={`avatar__status${online ? ' is-online' : ''}`}
          aria-hidden='true'
        />
      )}
    </span>
  )
}

export default Avatar
