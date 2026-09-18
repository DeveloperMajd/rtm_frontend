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
    footer={
      <>
        <Button variant='danger' onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
        <Button variant='tertiary' onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      </>
    }
  >
    <p>{message}</p>
  </Modal>
)

export default ConfirmDialog
