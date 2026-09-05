import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { addParticipant, kickParticipant } from '../../services/api/conversations'
import { getAllUsers } from '../../services/api/users'
import Button from '../ui/Button'
import OnlineStatus from '../ui/OnlineStatus'
import type { ConversationType } from '../../utils/baseTypes'

type GroupSettingsPanelProps = {
  conversation: ConversationType
  currentUserId: string
  onClose: () => void
}

const GroupSettingsPanel = ({ conversation, currentUserId, onClose }: GroupSettingsPanelProps) => {
  const participants = conversation.participants ?? []
  const isAdmin = participants.some((p) => p.user_id === currentUserId && p.role === 'admin')

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
    enabled: isAdmin,
  })

  const participantIds = new Set(participants.map((p) => p.user_id))
  const addableUsers = allUsers.filter((u) => !participantIds.has(u.id))

  const { mutate: add, isPending: isAdding } = useMutation({
    mutationFn: (userId: string) => addParticipant(conversation.id, userId),
    onError: () => toast.error('Failed to add participant. Please try again.'),
  })

  const { mutate: kick, isPending: isKicking } = useMutation({
    mutationFn: (userId: string) => kickParticipant(conversation.id, userId),
    onError: () => toast.error('Failed to remove participant. Please try again.'),
  })

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
          <h2 className='text-lg font-semibold'>{conversation.title || 'Group Settings'}</h2>
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
              Members ({participants.length})
            </label>
            <ul className='border border-gray-300 rounded max-h-48 overflow-y-auto divide-y divide-gray-100'>
              {participants.map((p) => (
                <li
                  key={p.user_id}
                  className='flex items-center justify-between px-3 py-2'
                >
                  <span className='flex items-center gap-2 text-sm text-gray-800'>
                    <OnlineStatus isOnline={p.is_online} />
                    {p.name}
                    {p.role === 'admin' && (
                      <span className='ml-2 text-xs text-blue-600 font-medium'>Admin</span>
                    )}
                  </span>
                  {isAdmin && p.user_id !== currentUserId && (
                    <button
                      type='button'
                      onClick={() => kick(p.user_id)}
                      disabled={isKicking}
                      className='text-xs text-red-500 hover:underline disabled:opacity-50'
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isAdmin && (
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Add participant
              </label>
              {addableUsers.length === 0 ? (
                <p className='text-sm text-gray-400'>No more users to add.</p>
              ) : (
                <ul className='border border-gray-300 rounded max-h-48 overflow-y-auto divide-y divide-gray-100'>
                  {addableUsers.map((u) => (
                    <li
                      key={u.id}
                      className='flex items-center justify-between px-3 py-2'
                    >
                      <span className='text-sm text-gray-800'>{u.name}</span>
                      <button
                        type='button'
                        onClick={() => add(u.id)}
                        disabled={isAdding}
                        className='text-xs text-blue-500 hover:underline disabled:opacity-50'
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className='flex justify-end mt-2'>
            <Button
              variant='tertiary'
              label='Close'
              onClick={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default GroupSettingsPanel
