import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { FOCUSABLE, useModalBehavior } from '../../hooks/useModalBehavior'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /** Hide the visible header (title still labels the dialog for AT). */
  hideHeader?: boolean
}

// Prefer the first focusable inside the body (usually a real field) over
// the header close button.
const initialFocus = (panel: HTMLElement) =>
  panel.querySelector('.modal-panel__body')?.querySelector<HTMLElement>(FOCUSABLE) ?? null

/**
 * Accessible dialog: role="dialog" + aria-modal, focus trap, Escape to close,
 * focus restored to the trigger on close, and the rest of the app marked
 * `inert` while it is open (see useModalBehavior).
 */
const Modal = ({ open, onClose, title, children, footer, hideHeader }: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useModalBehavior({ open, containerRef: panelRef, onClose, getInitialFocus: initialFocus })

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
              <Icon name='x' />
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
