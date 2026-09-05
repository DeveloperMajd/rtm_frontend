import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getAllUsers } from '../../services/api/users'
import { createConversation } from '../../services/api/conversations'
import Spinner from '../ui/Spinner'
import OnlineStatus from '../ui/OnlineStatus'
import useAuth from '../../hooks/useAuth'
import useConversations from '../../hooks/useConversations'

type ContactsProps = {
  onConversationOpened: () => void
}

const Contacts = ({ onConversationOpened }: ContactsProps) => {
  const { user: currentUser } = useAuth()
  const { conversations } = useConversations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: allUsers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
    // Online status has no realtime push (it's a Redis TTL heartbeat, not a
    // broadcast event), so poll at the same cadence as the heartbeat itself.
    refetchInterval: 15000,
  })

  const contacts = allUsers.filter((u) => u.id !== currentUser?.id)

  const { mutate: createDirectConversation, isPending } = useMutation({
    mutationFn: (userId: string) =>
      createConversation({ type: 'direct', participant_ids: [userId] }),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      navigate(`/conversations/${response.data.id}`)
      onConversationOpened()
    },
    onError: () => toast.error('Failed to open conversation. Please try again.'),
  })

  // Contacts is the "who can I online-check" list, so it gets clicked
  // repeatedly. Only hit the (throttled) create endpoint for a conversation
  // that doesn't exist yet — reuse the id we already have otherwise.
  const openConversationWith = (userId: string) => {
    const existing = conversations.find(
      (c) => c.type === 'direct' && c.other_participant?.id === userId,
    )

    if (existing) {
      navigate(`/conversations/${existing.id}`)
      onConversationOpened()
      return
    }

    createDirectConversation(userId)
  }

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
              onClick={() => openConversationWith(contact.id)}
              disabled={isPending}
              className='w-full flex items-center gap-2 text-left border border-gray-300 rounded p-2 mb-2 cursor-pointer hover:bg-gray-100 disabled:opacity-50'
            >
              <OnlineStatus isOnline={!!contact.is_online} />
              {contact.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Contacts
