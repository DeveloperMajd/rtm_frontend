import type { ReactNode } from 'react'
import Modal from './Modal'
import Button from './Button'
import type { IconName } from './icons'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** The glyph in the dialog's tile; a warning sign when not given. */
  icon?: IconName
  loading?: boolean
  /** Holds the confirm button back until the dialog's own condition is
   * met — a typed name, a chosen member. */
  confirmDisabled?: boolean
  /** Anything the confirmation needs besides the message (a field, a list). */
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirms a destructive action (States-Confirmations, Groups-Dialogs): a
 * danger-tinted tile, the consequence spelled out under the title, Cancel
 * first and the action last in red.
 */
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon = 'alert',
  loading = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    description={message}
    icon={icon}
    tone='danger'
    // Cancel first, the destructive action last and red-solid — the only
    // place that treatment appears (States-Confirmations).
    footer={
      <>
        <Button variant='tertiary' onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant='danger' onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    {children}
  </Modal>
)

export default ConfirmDialog
