import { cloneElement, useId, type ReactElement } from 'react'

interface TooltipProps {
  /** The tooltip's text, e.g. "Reply" or "Reply (R)" for a shortcut hint. */
  label: string
  /** A single focusable element (button, link, …) that forwards its props. */
  children: ReactElement<{ 'aria-describedby'?: string }>
  className?: string
}

/**
 * A hover/focus-shown text hint, CSS-driven (no positioning library): shown
 * on `:hover` (after a short delay, so passing the mouse over several
 * triggers doesn't flash a tooltip on each one) and on `:focus-within`
 * (immediately, for keyboard users). The trigger keeps its own
 * `aria-label`/visible text; this only adds a supplementary
 * `role="tooltip"` description, wired via `aria-describedby`.
 */
const Tooltip = ({ label, children, className = '' }: TooltipProps) => {
  const id = useId()

  return (
    <span className={`tooltip ${className}`.trim()}>
      {cloneElement(children, { 'aria-describedby': id })}
      <span role='tooltip' id={id} className='tooltip__bubble'>
        {label}
      </span>
    </span>
  )
}

export default Tooltip
