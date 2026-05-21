import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createConversation } from '../services/api/conversations'
import { getAllUsers } from '../services/api/users'
import type { UserType } from '../utils/baseTypes'
import Button from './UI/Buttons/Button'

interface ConversationModalProps {
  onClose: () => void
  onCreated: () => void
}

const ConversationModal = ({ onClose, onCreated }: ConversationModalProps) => {
  const [type, setType] = useState<'direct' | 'group'>('direct')
  const [title, setTitle] = useState('')
  const [users, setUsers] = useState<UserType[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    getAllUsers()
      .then(setUsers)
      .catch(() => toast.error('Failed to load users.'))
      .finally(() => setIsLoadingUsers(false))
  }, [])

  const toggleUser = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (type === 'direct') {
          return new Set([id])
        }
        next.add(id)
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one participant.')
      return
    }

    setIsSubmitting(true)
    try {
      await createConversation({
        type,
        title: type === 'group' && title.trim() ? title.trim() : undefined,
        participant_ids: Array.from(selectedIds),
      })
      onCreated()
      onClose()
    } catch {
      toast.error('Failed to create conversation. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
          <h2 className='text-lg font-semibold'>New Conversation</h2>
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
              Type
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as 'direct' | 'group')
                setSelectedIds(new Set())
              }}
              className='w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500'
            >
              <option value='direct'>Direct</option>
              <option value='group'>Group</option>
            </select>
          </div>

          {type === 'group' && (
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
          )}

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {type === 'direct' ? 'Select user' : 'Select participants'}
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
                        type={type === 'direct' ? 'radio' : 'checkbox'}
                        name='participant'
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
              onClick={() => {
                void handleCreate()
              }}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConversationModal
