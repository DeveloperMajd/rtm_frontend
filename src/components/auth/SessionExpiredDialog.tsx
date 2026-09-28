import { useMatch } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import useAuth from '../../hooks/useAuth'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { loadDraft } from '../../utils/drafts'
import { conversationTitle } from '../../utils/conversations'
import type { ConversationType } from '../../utils/baseTypes'

/**
 * Auth-Session-Expired: shown over the app, which stays on screen behind it,
 * when the server stops accepting this session. It can't be dismissed —
 * nothing behind it works any more — and its one action goes to sign in,
 * which brings the viewer back to this same page afterwards. Unsent text is
 * already saved on this device (see utils/drafts), and says so when there
 * is some in the open conversation.
 */
const SessionExpiredDialog = () => {
  const { user, sessionExpired, endExpiredSession } = useAuth()
  const queryClient = useQueryClient()
  const openId = useMatch('/conversations/:id')?.params.id

  let draftIn: string | null = null
  if (sessionExpired && user && openId && loadDraft(user.id, openId).trim()) {
    const open = queryClient
      .getQueryData<{ data: ConversationType[] }>(['conversations'])
      ?.data.find((c) => c.id === openId)
    draftIn = open ? conversationTitle(open) : 'this conversation'
  }

  return (
    <Modal
      open={sessionExpired}
      onClose={endExpiredSession}
      dismissible={false}
      alert
      icon='lock'
      tone='warn'
      title='You’ve been signed out'
      description={
        draftIn ? (
          <>
            Your session expired. Sign in again to carry on — your unsent draft in “{draftIn}” is kept on
            this device.
          </>
        ) : (
          'Your session expired. Sign in again to carry on.'
        )
      }
      footer={
        <Button onClick={endExpiredSession}>
          <Icon name='login' size={16} />
          Sign in again
        </Button>
      }
    />
  )
}

export default SessionExpiredDialog
