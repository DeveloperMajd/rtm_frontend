import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { createConversation } from '../../services/api/conversations'
import { getAllUsers } from '../../services/api/users'
import Button from '../ui/Button'
import useAuth from '../../hooks/useAuth'

interface GroupModalProps {
  onClose: () => void
}

const GroupModal = ({ onClose }: GroupModalProps) => {
  const [title, setTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
  })

  const users = allUsers.filter((u) => u.id !== currentUser?.id)

  const { mutate: create, isPending: isSubmitting } = useMutation({
    mutationFn: createConversation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      onClose()
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
    if (selectedIds.size === 0) {
      toast.error('Select at least one participant.')
      return
    }
    create({
      type: 'group',
      title: title.trim() || undefined,
      participant_ids: Array.from(selectedIds),
    })
  }

  return (
    <div
      className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg p-6 w-full max-w-md shadow-lg'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold'>New Group</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 text-2xl leading-none'
          >
            &times;
          </button>
        </div>

        <div className='flex flex-col gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Title
            </label>
            <input
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Group name'
              className='w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Select participants
            </label>
            {isLoadingUsers ? (
              <p className='text-sm text-gray-400'>Loading users…</p>
            ) : users.length === 0 ? (
              <p className='text-sm text-gray-400'>No users found.</p>
            ) : (
              <ul className='border border-gray-300 rounded max-h-48 overflow-y-auto divide-y divide-gray-100'>
                {users.map((user) => (
                  <li key={user.id}>
                    <label className='flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className='accent-blue-500'
                      />
                      <span className='text-sm text-gray-800'>{user.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className='flex justify-end gap-2 mt-2'>
            <Button
              variant='tertiary'
              label='Cancel'
              onClick={onClose}
              disabled={isSubmitting}
            />
            <Button
              variant='primary'
              label={isSubmitting ? 'Creating…' : 'Create'}
              onClick={handleCreate}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default GroupModal
