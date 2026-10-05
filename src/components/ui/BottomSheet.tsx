import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Badge from './Badge'
import Icon from './Icon'
import type { IconName } from './icons'
import { useModalBehavior } from '../../hooks/useModalBehavior'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** Keep the title for assistive tech only — for a sheet whose contents
   * say what it's for (the message a long-press opened it on). */
  hideTitle?: boolean
  /** A line under the list, like the attach sheet's file limits. */
  note?: ReactNode
  children: ReactNode
}

/**
 * A panel that rises from the bottom of a phone screen (Mobile-NewChat-Flow,
 * Mobile-Attachments-Flow, Mobile-430-Message-Sheet) — a short list of
 * choices, where a desktop would use a menu. From 768px it sits in the
 * middle of the screen instead, like any other dialog.
 *
 * Modal, like Modal: focus moves inside and stays there, Escape or a tap
 * on the dimmed page closes it, and focus goes back where it came from.
 */
const BottomSheet = ({ open, onClose, title, hideTitle = false, note, children }: BottomSheetProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useModalBehavior({ open, containerRef: panelRef, onClose })

  if (!open) return null

  return createPortal(
    <div
      className='sheet-overlay'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className='sheet'
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className='sheet__grabber' aria-hidden='true' />
        <h2 id={titleId} className={hideTitle ? 'sr-only' : 'sheet__title'}>
          {title}
        </h2>
        <div className='sheet__body'>{children}</div>
        {note && <p className='sheet__note'>{note}</p>}
      </div>
    </div>,
    document.body,
  )
}

interface SheetActionProps {
  icon: IconName
  label: string
  /** A second line saying what the choice does. */
  hint?: string
  tone?: 'danger'
  /** Shown but not available yet — disabled, and tagged Soon. */
  soon?: boolean
  disabled?: boolean
  onSelect?: () => void
}

/** One choice in a sheet: an icon tile, a label and, optionally, a hint. */
export const SheetAction = ({ icon, label, hint, tone, soon = false, disabled = false, onSelect }: SheetActionProps) => (
  <button
    type='button'
    className={`sheet-action${tone === 'danger' ? ' is-danger' : ''}`}
    disabled={disabled || soon}
    onClick={onSelect}
  >
    <span className='sheet-action__icon' aria-hidden='true'>
      <Icon name={icon} size={18} />
    </span>
    <span className='sheet-action__text'>
      <span className='sheet-action__label'>
        {label}
        {soon && (
          <>
            {' '}
            <Badge tone='soon'>Soon</Badge>
          </>
        )}
      </span>
      {hint && <span className='sheet-action__hint'>{hint}</span>}
    </span>
  </button>
)

export default BottomSheet
