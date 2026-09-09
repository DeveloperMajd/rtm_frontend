import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { removeContact } from '../../services/api/contacts'
import useContacts from '../../hooks/useContacts'
import useConversations from '../../hooks/useConversations'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { ConversationListSkeleton } from '../ui/Skeleton'
import AddContactModal from './AddContactModal'

type ContactsProps = {
  onConversationOpened: () => void
}

const Contacts = ({ onConversationOpened }: ContactsProps) => {
  const { data: contacts = [], isLoading, error } = useContacts()
  const { conversations } = useConversations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const remove = useMutation({
    mutationFn: (userId: string) => removeContact(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
    onError: () => toast.error('Could not remove contact'),
  })

  const openConversationWith = (userId: string) => {
    const existing = conversations.find(
      (c) => c.type === 'direct' && c.other_participant?.id === userId,
    )
    if (existing) {
      navigate(`/conversations/${existing.id}`)
      onConversationOpened()
    }
  }

  return (
    <>
      <div style={{ padding: '0.75rem 1rem 0' }}>
        <Button variant='secondary' block onClick={() => setAddOpen(true)}>
          + Add contact
        </Button>
      </div>

      {isLoading ? (
        <ConversationListSkeleton />
      ) : error ? (
        <p className='empty-state'>Error: {(error as Error).message}</p>
      ) : contacts.length === 0 ? (
        <p className='empty-state'>
          No contacts yet. Use &ldquo;Add contact&rdquo; to find someone by name or email.
        </p>
      ) : (
        <ul>
          {contacts.map((contact) => (
            <li key={contact.id} className='contact-row'>
              <button
                type='button'
                className='contact-row__open'
                onClick={() => openConversationWith(contact.id)}
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
              <Button
                variant='ghost'
                icon
                className='contact-row__remove'
                onClick={() => remove.mutate(contact.id)}
                disabled={remove.isPending}
                aria-label={`Remove ${contact.name} from contacts`}
              >
                &times;
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AddContactModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(conversationId) => {
          navigate(`/conversations/${conversationId}`)
          onConversationOpened()
        }}
      />
    </>
  )
}

export default Contacts
