import { useState } from 'react'
import { createConversation } from '../services/api/conversations'
import Button from './UI/Buttons/Button'

interface ConversationModalProps {
  onClose: () => void
  onCreated: () => void
}

const ConversationModal = ({ onClose, onCreated }: ConversationModalProps) => {
  const [type, setType] = useState<'direct' | 'group'>('direct')
  const [title, setTitle] = useState('')
  const [participantInput, setParticipantInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)

    const participantIds = participantInput
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))

    if (participantIds.length === 0) {
      setError('Enter at least one participant ID.')
      return
    }

    setIsSubmitting(true)
    try {
      await createConversation({
        type,
        title: type === 'group' && title.trim() ? title.trim() : undefined,
        participantIds,
      })
      onCreated()
      onClose()
    } catch {
      setError('Failed to create conversation. Please try again.')
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
              onChange={(e) => setType(e.target.value as 'direct' | 'group')}
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
              Participant IDs
            </label>
            <input
              type='text'
              value={participantInput}
              onChange={(e) => setParticipantInput(e.target.value)}
              placeholder='e.g. 1, 2, 3'
              className='w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500'
            />
            <p className='text-xs text-gray-400 mt-1'>
              Comma-separated IDs — will become a user picker once auth is ready.
            </p>
          </div>

          {error && <p className='text-sm text-red-500'>{error}</p>}

          <div className='flex justify-end gap-2 mt-2'>
            <Button
              variant='tertiary'
              label='Cancel'
              onClick={onClose}
              disabled={isSubmitting}
            />
            <Button
              variant='primary'
              label={isSubmitting ? 'Creating...' : 'Create'}
              onClick={() => { void handleCreate() }}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConversationModal
