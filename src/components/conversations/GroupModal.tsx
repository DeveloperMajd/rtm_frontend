import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createConversation } from '../../services/api/conversations'
import { getContacts } from '../../services/api/contacts'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import PersonRow from './PersonRow'

interface GroupModalProps {
  open: boolean
  onClose: () => void
  /** "No contacts yet" offers to add one — the shell opens that dialog. */
  onAddContact?: () => void
}

/**
 * New group (Groups-NewGroupDialog). The name is optional — a group without
 * one is titled by its members — and at least one person is required, the
 * same rules the API applies. The creator becomes the group's admin.
 */
const GroupModal = ({ open, onClose, onAddContact }: GroupModalProps) => {
  const [title, setTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    enabled: open,
  })

  const reset = () => {
    setTitle('')
    setSelectedIds(new Set())
  }

  const close = () => {
    reset()
    onClose()
  }

  const { mutate: create, isPending: isSubmitting } = useMutation({
    mutationFn: createConversation,
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      reset()
      onClose()
      if (response?.data?.id) navigate(`/conversations/${response.data.id}`)
    },
    onError: () => toast.error('Failed to create group. Please try again.'),
  })

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleCreate = () => {
    if (selectedIds.size === 0) return
    create({
      type: 'group',
      title: title.trim() || undefined,
      participant_ids: Array.from(selectedIds),
    })
  }

  const selected = users.filter((u) => selectedIds.has(u.id))
  const noContacts = !isLoading && users.length === 0

  return (
    <Modal
      open={open}
      onClose={close}
      title='New group'
      description='Pick a name and the people who should be in it.'
      icon='users'
      footer={
        <>
          <Button variant='tertiary' onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={isSubmitting} disabled={selectedIds.size === 0}>
            {isSubmitting ? 'Creating…' : 'Create group'}
          </Button>
        </>
      }
    >
      {/* Locked while the group is being created, so what's sent is what
          was on screen. */}
      <fieldset className='dialog-fieldset' disabled={isSubmitting}>
        <div className='field'>
          <label className='field__label' htmlFor='group-title'>
            Group name
          </label>
          <input
            id='group-title'
            className='input'
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. Weekend plans (optional)'
            aria-describedby='group-title-hint'
          />
          <p id='group-title-hint' className='field__hint'>
            You’ll be the group’s admin.
          </p>
        </div>

        <p className='dialog-section'>
          <span>Add people</span>
          {!noContacts && (
            <span className={`dialog-section__count${selectedIds.size > 0 ? ' is-active' : ''}`}>
              {selectedIds.size} selected
            </span>
          )}
        </p>

        {isLoading ? (
          <p className='muted'>Loading…</p>
        ) : noContacts ? (
          <div className='dialog-state'>
            <span className='dialog-state__icon'>
              <Icon name='userPlus' size={20} />
            </span>
            <p className='dialog-state__title'>No contacts yet</p>
            <p className='dialog-state__text'>Add a contact first, then bring them into a group.</p>
            {onAddContact && (
              <Button
                variant='secondary'
                className='dialog-state__action'
                onClick={() => {
                  close()
                  onAddContact()
                }}
              >
                <Icon name='userPlus' size={16} />
                Add contact
              </Button>
            )}
          </div>
        ) : (
          <>
            {selected.length > 0 && (
              <ul className='person-chips' aria-label='Selected people'>
                {selected.map((u) => (
                  <li key={u.id} className='person-chip'>
                    <Avatar name={u.name} src={u.avatar_url} size='xs' />
                    {u.name}
                    <button type='button' onClick={() => toggleUser(u.id)} aria-label={`Remove ${u.name}`}>
                      <Icon name='x' size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ul className='people-list'>
              {users.map((u) => (
                <li key={u.id}>
                  <PersonRow
                    name={u.name}
                    avatarUrl={u.avatar_url}
                    isOnline={u.is_online}
                    lastSeenAt={u.last_seen_at}
                    selected={selectedIds.has(u.id)}
                    control={
                      <input
                        type='checkbox'
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleUser(u.id)}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </fieldset>
    </Modal>
  )
}

export default GroupModal
