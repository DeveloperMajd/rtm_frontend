import type { MessageType } from '../../utils/baseTypes'
import { systemMessageText } from '../../utils/systemMessageText'
import useAuth from '../../hooks/useAuth'

/** Permanent in-thread group event line (WhatsApp-style). */
const SystemMessage = ({ message }: { message: MessageType }) => {
  const { user } = useAuth()
  return (
    <li className='system-message'>
      <span className='system-message__text'>{systemMessageText(message, user?.id)}</span>
    </li>
  )
}

export default SystemMessage
