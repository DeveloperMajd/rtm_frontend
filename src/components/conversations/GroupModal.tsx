import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createConversation } from '../../services/api/conversations'
import { getAllUsers } from '../../services/api/users'
import useAuth from '../../hooks/useAuth'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import Modal from '../ui/Modal'

interface GroupModalProps {
  open: boolean
  onClose: () => void
}

const GroupModal = ({ open, onClose }: GroupModalProps) => {
  const [title, setTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
    enabled: open,
  })
  const users = allUsers.filter((u) => u.id !== currentUser?.id)

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

  const reset = () => {
    setTitle('')
    setSelectedIds(new Set())
  }

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
    if (selectedIds.size === 0) {
      toast.error('Select at least one person.')
      return
    }
    create({
      type: 'group',
      title: title.trim() || undefined,
      participant_ids: Array.from(selectedIds),
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title='New group'
      footer={
        <>
          <Button variant='tertiary' onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={isSubmitting}>
            Create group
          </Button>
        </>
      }
    >
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
          placeholder='Optional'
        />
      </div>

      <p className='field__label' style={{ margin: '1rem 0 0.35rem' }}>
        Add people ({selectedIds.size} selected)
      </p>
      {isLoading ? (
        <p className='muted'>Loading…</p>
      ) : users.length === 0 ? (
        <p className='muted'>No one to add.</p>
      ) : (
        <ul className='picker-list'>
          {users.map((u) => (
            <li key={u.id}>
              <label className='picker-list__row'>
                <input
                  type='checkbox'
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleUser(u.id)}
                />
                <Avatar name={u.name} src={u.avatar_url} size='sm' />
                <span>{u.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export default GroupModal
