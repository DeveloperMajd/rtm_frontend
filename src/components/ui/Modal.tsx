import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import type { IconName } from './icons'
import { FOCUSABLE, useModalBehavior } from '../../hooks/useModalBehavior'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** A line under the title saying what the dialog is for, or — for a
   * confirmation — what will happen. */
  description?: ReactNode
  /** The glyph in the tile beside the title (Groups-Dialogs). */
  icon?: IconName
  /** `danger` tints that tile for a destructive dialog, `warn` for one
   * that reports something that went wrong on its own. */
  tone?: 'accent' | 'danger' | 'warn'
  children?: ReactNode
  footer?: ReactNode
  /** Hide the visible header (title still labels the dialog for AT). */
  hideHeader?: boolean
  /** False for a dialog that has to be answered: no close button, and
   * neither Escape nor a click outside dismisses it. */
  dismissible?: boolean
  /** An interruption the viewer didn't ask for (role="alertdialog"). */
  alert?: boolean
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
const Modal = ({
  open,
  onClose,
  title,
  description,
  icon,
  tone = 'accent',
  children,
  footer,
  hideHeader,
  dismissible = true,
  alert = false,
}: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const close = dismissible ? onClose : () => {}

  useModalBehavior({ open, containerRef: panelRef, onClose: close, getInitialFocus: initialFocus })

  if (!open) return null

  return createPortal(
    <div
      className={`modal-overlay${alert ? ' is-alert' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={panelRef}
        className='modal-panel'
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {hideHeader ? (
          <h2 id={titleId} className='sr-only'>
            {title}
          </h2>
        ) : (
          <div className='modal-panel__header'>
            {icon && (
              <span className={`modal-panel__icon is-${tone}`} aria-hidden='true'>
                <Icon name={icon} size={18} />
              </span>
            )}
            <div className='modal-panel__heading'>
              <h2 id={titleId} className='modal-panel__title'>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className='modal-panel__description'>
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button
                type='button'
                className='modal-panel__close'
                onClick={onClose}
                aria-label='Close dialog'
              >
                <Icon name='x' />
              </button>
            )}
          </div>
        )}
        {children && <div className='modal-panel__body'>{children}</div>}
        {footer && <div className='modal-panel__footer'>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
