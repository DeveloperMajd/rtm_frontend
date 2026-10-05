export type SignalState = 'connected' | 'connecting' | 'reconnecting' | 'offline'

interface SignalBarsProps {
  state: SignalState
  className?: string
}

const BAR_COUNT = 3

const LIT_BARS: Record<SignalState, number> = {
  connected: 3,
  reconnecting: 2,
  connecting: 1,
  offline: 0,
}

/**
 * The Signal design system's own connection-quality motif (DS-Signal-Motion:
 * "one motif, five jobs" — this is the connection-quality job; later stages
 * reuse the same shape for delivery state, unread and typing). Purely
 * decorative/ambient — the accessible status text lives in the caller (e.g.
 * ConversationsLayout's connection banner), so this stays `aria-hidden`.
 */
const SignalBars = ({ state, className = '' }: SignalBarsProps) => {
  const lit = LIT_BARS[state]

  return (
    <span className={`signal-bars is-${state} ${className}`.trim()} aria-hidden='true'>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <i key={i} className={i < lit ? 'is-lit' : undefined} />
      ))}
    </span>
  )
}

export default SignalBars
