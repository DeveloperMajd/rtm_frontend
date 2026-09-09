import { formatDistanceToNow } from 'date-fns'

type OnlineStatusProps = {
  isOnline: boolean
  lastSeenAt?: string | null
  showLabel?: boolean
}

const OnlineStatus = ({ isOnline, lastSeenAt, showLabel = false }: OnlineStatusProps) => {
  const dot = (
    <span
      aria-hidden='true'
      style={{
        display: 'inline-block',
        width: '0.5rem',
        height: '0.5rem',
        borderRadius: '999px',
        flex: '0 0 auto',
        backgroundColor: isOnline ? 'var(--c-online)' : 'var(--c-muted)',
      }}
    />
  )

  if (!showLabel) return dot

  const label = isOnline
    ? 'Online'
    : lastSeenAt
      ? `Last seen ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`
      : 'Offline'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.75rem',
        color: 'var(--c-muted)',
      }}
    >
      {dot}
      {label}
    </span>
  )
}

export default OnlineStatus
