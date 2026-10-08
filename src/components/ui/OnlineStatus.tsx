import type { CSSProperties } from 'react'
import type { PresenceStatus } from '../../utils/baseTypes'
import { presenceLabel } from '../../utils/presence'

type OnlineStatusProps = {
  status: PresenceStatus
  lastSeenAt?: string | null
  showLabel?: boolean
}

/** The dot's look for each status, in the avatar's shapes (DS-Icons-
 * Avatars): filled for online, half-filled for away, grey for offline. */
const DOT: Record<PresenceStatus, CSSProperties> = {
  online: { backgroundColor: 'var(--c-accent)' },
  away: {
    background: 'linear-gradient(90deg, var(--c-accent) 50%, transparent 50%)',
    boxShadow: 'inset 0 0 0 1.5px var(--c-accent)',
  },
  offline: { backgroundColor: 'var(--c-fg-2)' },
}

const OnlineStatus = ({ status, lastSeenAt, showLabel = false }: OnlineStatusProps) => {
  const dot = (
    <span
      aria-hidden='true'
      style={{
        display: 'inline-block',
        width: '0.5rem',
        height: '0.5rem',
        borderRadius: '999px',
        flex: '0 0 auto',
        ...DOT[status],
      }}
    />
  )

  if (!showLabel) return dot

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.75rem',
        color: 'var(--c-fg-2)',
      }}
    >
      {dot}
      {presenceLabel(status, lastSeenAt)}
    </span>
  )
}

export default OnlineStatus
