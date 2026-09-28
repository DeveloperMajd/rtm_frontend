import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import Icon from './Icon'
import type { IconName } from './icons'

type FieldChromeProps = {
  /** Visible label — every field gets one, even when a caller wants it
   * visually hidden (pass `labelClassName='sr-only'`). */
  label: string
  hint?: string
  error?: string
  id?: string
  labelClassName?: string
  /** Sits at the right of the label row: a "Forgot password?" link, a
   * character count. */
  labelAside?: ReactNode
}

/** The label row: the label, and whatever sits opposite it. */
export const FieldLabel = ({
  htmlFor,
  label,
  className,
  aside,
}: {
  htmlFor: string
  label: string
  className?: string
  aside?: ReactNode
}) => {
  const labelEl = (
    <label className={className ?? 'field__label'} htmlFor={htmlFor}>
      {label}
    </label>
  )
  if (!aside) return labelEl
  return (
    <div className='field__label-row'>
      {labelEl}
      {aside}
    </div>
  )
}

/** A field's error line, with the alert glyph the design pairs it with. */
export const FieldError = ({ id, children }: { id?: string; children: ReactNode }) => (
  <span className='field__error' id={id}>
    <Icon name='alertCircle' size={14} />
    {children}
  </span>
)

type InputProps = FieldChromeProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
    /** A glyph inside the box, before the text (the Profile email's lock). */
    icon?: IconName
  }

/**
 * The `.field` + `<label>` + `.input` + hint/error pattern repeated across
 * every form in the app, as one component: label association, and
 * `aria-invalid`/`aria-describedby` wired to the hint/error text
 * automatically instead of each form re-deriving it by hand.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, labelClassName, labelAside, icon, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  // A hint's id is only worth pointing aria-describedby at when its <span>
  // actually renders — otherwise it's a dangling reference to an element
  // that was never in the DOM (the error message, below, takes its place).
  const hintId = hint && !error ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  const input = (
    <input
      ref={ref}
      id={inputId}
      className={`input ${className}`.trim()}
      aria-invalid={error ? true : undefined}
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
      {...rest}
    />
  )

  return (
    <div className='field'>
      <FieldLabel htmlFor={inputId} label={label} className={labelClassName} aside={labelAside} />
      {icon ? (
        <div className='input-with-icon'>
          <Icon name={icon} size={16} />
          {input}
        </div>
      ) : (
        input
      )}
      {hint && !error && (
        <span className='field__hint' id={hintId}>
          {hint}
        </span>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
})

type TextareaProps = FieldChromeProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, labelClassName, labelAside, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const hintId = hint && !error ? `${textareaId}-hint` : undefined
  const errorId = error ? `${textareaId}-error` : undefined

  return (
    <div className='field'>
      <FieldLabel htmlFor={textareaId} label={label} className={labelClassName} aside={labelAside} />
      <textarea
        ref={ref}
        id={textareaId}
        className={`textarea ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...rest}
      />
      {hint && !error && (
        <span className='field__hint' id={hintId}>
          {hint}
        </span>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
})

export default Input
