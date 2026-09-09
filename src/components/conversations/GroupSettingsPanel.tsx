import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { addParticipant, kickParticipant } from '../../services/api/conversations'
import { getAllUsers } from '../../services/api/users'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import Modal from '../ui/Modal'
import type { ConversationType } from '../../utils/baseTypes'

type GroupSettingsPanelProps = {
  open: boolean
  conversation: ConversationType
  currentUserId: string
  onClose: () => void
}

const GroupSettingsPanel = ({ open, conversation, currentUserId, onClose }: GroupSettingsPanelProps) => {
  const queryClient = useQueryClient()
  const participants = (conversation.participants ?? []).filter((p) => !p.left_at)
  const isAdmin = participants.some((p) => p.user_id === currentUserId && p.role === 'admin')

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
    enabled: isAdmin && open,
  })

  const participantIds = new Set(participants.map((p) => p.user_id))
  const addableUsers = allUsers.filter((u) => !participantIds.has(u.id))

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  const { mutate: add, isPending: isAdding } = useMutation({
    mutationFn: (userId: string) => addParticipant(conversation.id, userId),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to add participant. Please try again.'),
  })

  const { mutate: kick, isPending: isKicking } = useMutation({
    mutationFn: (userId: string) => kickParticipant(conversation.id, userId),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to remove participant. Please try again.'),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={conversation.title || 'Group settings'}
      footer={
        <Button variant='tertiary' onClick={onClose}>
          Close
        </Button>
      }
    >
      <p className='field__label'>Members ({participants.length})</p>
      <ul className='picker-list' style={{ marginBottom: '1rem' }}>
        {participants.map((p) => (
          <li key={p.user_id}>
            <div className='member-row'>
              <span className='member-row__who'>
                <Avatar name={p.name} src={p.avatar_url} size='sm' online={p.is_online} />
                <span>{p.name}</span>
                {p.role === 'admin' && <span className='badge badge--admin'>Admin</span>}
              </span>
              {isAdmin && p.user_id !== currentUserId && (
                <span className='member-row__actions'>
                  <Button
                    variant='ghost'
                    onClick={() => kick(p.user_id)}
                    disabled={isKicking}
                    aria-label={`Remove ${p.name}`}
                  >
                    Remove
                  </Button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <>
          <p className='field__label'>Add people</p>
          {addableUsers.length === 0 ? (
            <p className='muted'>No more people to add.</p>
          ) : (
            <ul className='picker-list'>
              {addableUsers.map((u) => (
                <li key={u.id}>
                  <div className='member-row'>
                    <span className='member-row__who'>
                      <Avatar name={u.name} src={u.avatar_url} size='sm' />
                      <span>{u.name}</span>
                    </span>
                    <span className='member-row__actions'>
                      <Button variant='ghost' onClick={() => add(u.id)} disabled={isAdding}>
                        Add
                      </Button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  )
}

export default GroupSettingsPanel
