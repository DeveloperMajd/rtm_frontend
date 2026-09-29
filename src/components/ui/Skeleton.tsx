import type { CSSProperties } from 'react'

interface SkeletonProps {
  variant?: 'text' | 'line' | 'circle' | 'block'
  width?: string | number
  height?: string | number
  className?: string
}

const Skeleton = ({ variant = 'text', width, height, className = '' }: SkeletonProps) => {
  const style: CSSProperties = { width, height }
  return (
    <span
      className={`skeleton skeleton--${variant} ${className}`.trim()}
      style={style}
      aria-hidden='true'
    />
  )
}

/** A conversation-list placeholder: avatar + two text lines, repeated. */
export const ConversationListSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div aria-hidden='true'>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 1rem' }}>
        <Skeleton variant='circle' width='2.25rem' height='2.25rem' />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <Skeleton variant='line' width='55%' />
          <Skeleton variant='text' width='80%' />
        </div>
      </div>
    ))}
  </div>
)

// A conversation opening (States-Loading): bubbles in the shape of a chat,
// theirs on the left and yours on the right.
const BUBBLES: { own: boolean; width: string }[] = [
  { own: false, width: '44%' },
  { own: false, width: '60%' },
  { own: true, width: '36%' },
  { own: false, width: '52%' },
  { own: true, width: '64%' },
  { own: true, width: '28%' },
]

export const MessagesSkeleton = () => (
  <ul className='message-list msg-skeleton' aria-hidden='true'>
    {BUBBLES.map((bubble, i) => (
      <li key={i} className={`msg-skeleton__row${bubble.own ? ' is-own' : ''}`}>
        <span className='skeleton msg-skeleton__bubble' style={{ width: bubble.width }} />
      </li>
    ))}
  </ul>
)

export default Skeleton
