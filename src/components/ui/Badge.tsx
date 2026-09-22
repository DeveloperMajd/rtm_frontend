import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'admin' | 'left' | 'soon' | 'needs-api'

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/**
 * A small status tag (Admin, Left, …) or, with `tone='soon'`/`'needs-api'`,
 * the project's own honesty label for a control that's visible but not
 * wired to a real feature yet — pair it with `disabled` on that control.
 * `soon` and `needs-api` render identically (both mean "not live"); the
 * two tone names exist so the reason reads clearly at the call site.
 */
const Badge = ({ tone = 'neutral', children, className = '' }: BadgeProps) => (
  <span className={`badge badge--${tone} ${className}`.trim()}>{children}</span>
)

export default Badge
