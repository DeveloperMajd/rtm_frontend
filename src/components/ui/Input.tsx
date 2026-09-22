import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type FieldChromeProps = {
  /** Visible label — every field gets one, even when a caller wants it
   * visually hidden (pass `labelClassName='sr-only'`). */
  label: string
  hint?: string
  error?: string
  id?: string
  labelClassName?: string
}

type InputProps = FieldChromeProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>

/**
 * The `.field` + `<label>` + `.input` + hint/error pattern repeated across
 * every form in the app, as one component: label association, and
 * `aria-invalid`/`aria-describedby` wired to the hint/error text
 * automatically instead of each form re-deriving it by hand.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, labelClassName, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  // A hint's id is only worth pointing aria-describedby at when its <span>
  // actually renders — otherwise it's a dangling reference to an element
  // that was never in the DOM (the error message, below, takes its place).
  const hintId = hint && !error ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className='field'>
      <label className={labelClassName ?? 'field__label'} htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`input ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...rest}
      />
      {hint && !error && (
        <span className='field__hint' id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className='field__error' id={errorId}>
          {error}
        </span>
      )}
    </div>
  )
})

type TextareaProps = FieldChromeProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, labelClassName, className = '', ...rest },
  ref,
) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const hintId = hint && !error ? `${textareaId}-hint` : undefined
  const errorId = error ? `${textareaId}-error` : undefined

  return (
    <div className='field'>
      <label className={labelClassName ?? 'field__label'} htmlFor={textareaId}>
        {label}
      </label>
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
      {error && (
        <span className='field__error' id={errorId}>
          {error}
        </span>
      )}
    </div>
  )
})

export default Input
