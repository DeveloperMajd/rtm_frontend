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
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
    />
  )

  if (!showLabel) {
    return dot
  }

  const label = isOnline
    ? 'Online'
    : lastSeenAt
      ? `Last seen ${formatDistanceToNow(new Date(lastSeenAt), { includeSeconds: true })} ago`
      : 'Offline'

  return (
    <span className='inline-flex items-center gap-1.5 text-xs text-gray-500'>
      {dot}
      {label}
    </span>
  )
}

export default OnlineStatus
