import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getAllUsers } from '../../services/api/users'
import { createConversation } from '../../services/api/conversations'
import Avatar from '../ui/Avatar'
import { ConversationListSkeleton } from '../ui/Skeleton'
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

  if (isLoading) return <ConversationListSkeleton />
  if (error) return <p className='empty-state'>Error: {(error as Error).message}</p>
  if (contacts.length === 0) return <p className='empty-state'>No contacts found.</p>

  return (
    <ul>
      {contacts.map((contact) => (
        <li key={contact.id}>
          <button
            type='button'
            className='conversation-item'
            onClick={() => openConversationWith(contact.id)}
            disabled={isPending}
          >
            <Avatar
              name={contact.name}
              src={contact.avatar_url}
              size='md'
              online={!!contact.is_online}
            />
            <div className='conversation-item__body'>
              <span className='conversation-item__title'>{contact.name}</span>
              <span className='conversation-item__preview'>
                {contact.is_online ? 'Online' : 'Offline'}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default Contacts
