interface ActionToastProps {
  title: string
  body?: string
  actionLabel: string
  onAction: () => void
}

/**
 * Toast content with a title, an optional line of detail and one action,
 * e.g. "Couldn't delete the message · It's still there. Try again · Retry"
 * (Study-Edit-Delete). Pass it to react-hot-toast as the message; the
 * Toaster supplies the surface, icon and dismiss timer.
 */
const ActionToast = ({ title, body, actionLabel, onAction }: ActionToastProps) => (
  <div className='action-toast'>
    <div className='action-toast__text'>
      <strong>{title}</strong>
      {body && <span>{body}</span>}
    </div>
    <button type='button' className='action-toast__action' onClick={onAction}>
      {actionLabel}
    </button>
  </div>
)

export default ActionToast
