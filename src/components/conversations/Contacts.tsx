import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getAllUsers } from '../../services/api/users'
import { createConversation } from '../../services/api/conversations'
import Spinner from '../ui/Spinner'
import useAuth from '../../hooks/useAuth'

type ContactsProps = {
  onConversationOpened: () => void
}

const Contacts = ({ onConversationOpened }: ContactsProps) => {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: allUsers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
  })

  const contacts = allUsers.filter((u) => u.id !== currentUser?.id)

  const { mutate: openDirectConversation, isPending } = useMutation({
    mutationFn: (userId: string) =>
      createConversation({ type: 'direct', participant_ids: [userId] }),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      navigate(`/conversations/${response.data.id}`)
      onConversationOpened()
    },
    onError: () => toast.error('Failed to open conversation. Please try again.'),
  })

  return (
    <div className='contacts-container w-full p-4 overflow-y-auto'>
      {isLoading && (
        <div className='flex p-2'>
          <Spinner
            position='left'
            size={40}
            color='#6E026F'
          />
        </div>
      )}
      {error && <p className='error-msg'>Error: {(error as Error).message}</p>}
      <ul className='flex flex-col'>
        {!isLoading && !error && contacts.length === 0 && (
          <li className='text-sm text-gray-500'>No contacts found.</li>
        )}
        {contacts.map((contact) => (
          <li key={contact.id}>
            <button
              type='button'
              onClick={() => openDirectConversation(contact.id)}
              disabled={isPending}
              className='w-full text-left border border-gray-300 rounded p-2 mb-2 cursor-pointer hover:bg-gray-100 disabled:opacity-50'
            >
              {contact.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Contacts
