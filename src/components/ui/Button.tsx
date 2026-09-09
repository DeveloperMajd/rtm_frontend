import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost'

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: Variant
  /** Convenience prop; children take precedence when both are given. */
  label?: string
  children?: ReactNode
  /** Renders a busy state and blocks clicks without changing layout. */
  loading?: boolean
  block?: boolean
  icon?: boolean
  className?: string
}

/**
 * App button primitive. Forwards ref and every native button attribute
 * (`aria-*`, `form`, `name`, …) so callers can make it accessible without
 * the component needing to know about each case.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    type = 'button',
    variant = 'primary',
    label,
    children,
    loading = false,
    block = false,
    icon = false,
    disabled,
    className = '',
    ...rest
  },
  ref,
) {
  const classes = [
    'btn',
    variant,
    block ? 'block' : '',
    icon ? 'icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children ?? label}
    </button>
  )
})

export default Button
