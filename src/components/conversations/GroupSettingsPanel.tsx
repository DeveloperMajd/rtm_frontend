import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { AxiosError } from 'axios'
import {
  addParticipant,
  kickParticipant,
  leaveConversation,
  renameConversation,
  updateParticipantRole,
} from '../../services/api/conversations'
import { getContacts } from '../../services/api/contacts'
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

const apiMessage = (err: AxiosError<{ data?: { message?: string } }>, fallback: string) =>
  err.response?.data?.data?.message ?? fallback

const GroupSettingsPanel = ({ open, conversation, currentUserId, onClose }: GroupSettingsPanelProps) => {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(conversation.title ?? '')

  const participants = (conversation.participants ?? []).filter((p) => !p.left_at)
  const isAdmin = participants.some((p) => p.user_id === currentUserId && p.role === 'admin')
  const activeAdminCount = participants.filter((p) => p.role === 'admin').length
  const otherActiveCount = participants.filter((p) => p.user_id !== currentUserId).length
  const blockedFromLeaving = isAdmin && activeAdminCount <= 1 && otherActiveCount > 0

  const { data: myContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    enabled: isAdmin && open,
  })

  const participantIds = new Set(participants.map((p) => p.user_id))
  const addableUsers = myContacts.filter((u) => !participantIds.has(u.id))

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

  const { mutate: changeRole, isPending: isChangingRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'participant' }) =>
      updateParticipantRole(conversation.id, userId, role),
    onSuccess: invalidate,
    onError: (err: AxiosError<{ data?: { message?: string } }>) =>
      toast.error(apiMessage(err, 'Failed to update role. Please try again.')),
  })

  const { mutate: leave, isPending: isLeaving } = useMutation({
    mutationFn: () => leaveConversation(conversation.id, currentUserId),
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError: (err: AxiosError<{ data?: { message?: string } }>) =>
      toast.error(apiMessage(err, 'Failed to leave the group.')),
  })

  const { mutate: rename, isPending: isRenaming } = useMutation({
    mutationFn: (newTitle: string) => renameConversation(conversation.id, newTitle),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to rename the group.'),
  })

  const titleDirty = title.trim().length > 0 && title.trim() !== (conversation.title ?? '')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={conversation.title || 'Group settings'}
      footer={
        <>
          <Button
            variant='danger'
            onClick={() => leave()}
            loading={isLeaving}
            disabled={blockedFromLeaving}
            title={
              blockedFromLeaving
                ? 'Promote another member to admin before you can leave'
                : undefined
            }
          >
            Leave group
          </Button>
          <Button variant='tertiary' onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {blockedFromLeaving && (
        <p className='field__hint' style={{ marginBottom: '1rem' }}>
          You&rsquo;re the only admin. Promote someone else before you can leave.
        </p>
      )}

      {isAdmin && (
        <div className='field' style={{ marginBottom: '1.25rem' }}>
          <label className='field__label' htmlFor='group-rename'>
            Group name
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id='group-rename'
              className='input'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button
              variant='secondary'
              disabled={!titleDirty}
              loading={isRenaming}
              onClick={() => rename(title.trim())}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      <p className='field__label'>Members ({participants.length})</p>
      <ul className='picker-list' style={{ marginBottom: '1rem' }}>
        {participants.map((p) => {
          const isSelf = p.user_id === currentUserId
          const isSoleAdmin = p.role === 'admin' && activeAdminCount <= 1

          return (
            <li key={p.user_id}>
              <div className='member-row'>
                <span className='member-row__who'>
                  <Avatar name={p.name} src={p.avatar_url} size='sm' online={p.is_online} />
                  <span>
                    {p.name}
                    {isSelf ? ' (you)' : ''}
                  </span>
                  {p.role === 'admin' && <span className='badge badge--admin'>Admin</span>}
                </span>
                {isAdmin && !isSelf && (
                  <span className='member-row__actions'>
                    <Button
                      variant='ghost'
                      onClick={() =>
                        changeRole({
                          userId: p.user_id,
                          role: p.role === 'admin' ? 'participant' : 'admin',
                        })
                      }
                      disabled={isChangingRole || isSoleAdmin}
                      title={isSoleAdmin ? 'Promote someone else first' : undefined}
                    >
                      {p.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </Button>
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
          )
        })}
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
