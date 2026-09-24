import Modal from './Modal'
import Button from './Button'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    // Cancel first, the destructive action last and red-solid — the only
    // place that treatment appears (States-Confirmations).
    footer={
      <>
        <Button variant='tertiary' onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant='danger' onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p>{message}</p>
  </Modal>
)

export default ConfirmDialog
