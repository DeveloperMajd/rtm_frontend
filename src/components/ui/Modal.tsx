import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /** Hide the visible header (title still labels the dialog for AT). */
  hideHeader?: boolean
}

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessible dialog: role="dialog" + aria-modal, focus trap, Escape to close,
 * focus restored to the trigger on close, and the rest of the app marked
 * `inert` while it is open.
 */
const Modal = ({ open, onClose, title, children, footer, hideHeader }: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // Hold the latest onClose in a ref so the focus-trap effect below depends
  // only on `open` — a parent passing a new onClose each render must not
  // re-run setup (which would yank focus back to the first focusable).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    // Prefer the first focusable inside the body (usually a real field) over
    // the header close button.
    const body = panel?.querySelector<HTMLElement>('.modal-panel__body')
    const first =
      body?.querySelector<HTMLElement>(FOCUSABLE) ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      root?.removeAttribute('inert')
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className='modal-overlay'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className='modal-panel'
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {hideHeader ? (
          <h2 id={titleId} className='sr-only'>
            {title}
          </h2>
        ) : (
          <div className='modal-panel__header'>
            <h2 id={titleId} className='modal-panel__title'>
              {title}
            </h2>
            <button
              type='button'
              className='modal-panel__close'
              onClick={onClose}
              aria-label='Close dialog'
            >
              &times;
            </button>
          </div>
        )}
        <div className='modal-panel__body'>{children}</div>
        {footer && <div className='modal-panel__footer'>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
