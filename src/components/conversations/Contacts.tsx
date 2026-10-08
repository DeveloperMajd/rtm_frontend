import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { removeContact } from '../../services/api/contacts'
import useContacts from '../../hooks/useContacts'
import useConversations from '../../hooks/useConversations'
import { presenceLabel, presenceOf } from '../../utils/presence'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'
import { ConversationListSkeleton } from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'
import type { ContactType } from '../../utils/baseTypes'

type ContactsProps = {
  onConversationOpened: () => void
  /** Opens the Add contact dialog (owned by the shell, which the New group
   * dialog also opens it from). */
  onAddContact: () => void
}

/**
 * The contacts list (Contacts-1440): filter, add, and one row per contact.
 * Choosing a contact opens your conversation with them, as it always has;
 * the row's actions offer the same, plus removing them (after asking).
 */
const Contacts = ({ onConversationOpened, onAddContact }: ContactsProps) => {
  const { data: contacts = [], isLoading, error, refetch } = useContacts()
  const { conversations } = useConversations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')
  const [removing, setRemoving] = useState<ContactType | null>(null)

  const remove = useMutation({
    mutationFn: (userId: string) => removeContact(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setRemoving(null)
    },
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

  const needle = filter.trim().toLowerCase()
  const shown = needle ? contacts.filter((c) => c.name.toLowerCase().includes(needle)) : contacts
  const onlineCount = contacts.filter((c) => c.is_online).length

  // Contacts-Mobile "Empty · no contacts yet": nothing to filter, so the
  // state stands alone with its one way forward.
  const hasNone = !isLoading && !error && contacts.length === 0

  return (
    <div className='contacts'>
      {!hasNone && (
        <div className='contacts__tools'>
          <div className='input-with-icon'>
            <Icon name='search' size={16} />
            <input
              className='input'
              type='search'
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder='Search contacts'
              aria-label='Search contacts'
            />
          </div>
          <Button variant='secondary' block onClick={onAddContact}>
            <Icon name='plus' size={16} />
            Add contact
          </Button>
        </div>
      )}

      {isLoading ? (
        <ConversationListSkeleton />
      ) : error && contacts.length === 0 ? (
        <EmptyState
          icon='wifiOff'
          tone='danger'
          title='Couldn’t load your contacts'
          actions={
            <Button variant='secondary' className='sm' onClick={() => void refetch()}>
              <Icon name='refresh' size={14} />
              Try again
            </Button>
          }
        >
          Check your connection and try again.
        </EmptyState>
      ) : hasNone ? (
        <EmptyState
          icon='users'
          title='No contacts yet'
          actions={
            <Button className='sm' onClick={onAddContact}>
              <Icon name='userPlus' size={14} />
              Add contact
            </Button>
          }
        >
          Find people by name or email. Adding someone opens your chat right away.
        </EmptyState>
      ) : shown.length === 0 ? (
        <p className='empty-state'>No contacts match &ldquo;{filter.trim()}&rdquo;.</p>
      ) : (
        <ul className='contacts__list'>
          {shown.map((contact) => (
            <li key={contact.id} className='contact-row'>
              <button
                type='button'
                className='contact-row__open'
                onClick={() => openConversationWith(contact.id)}
              >
                <Avatar name={contact.name} src={contact.avatar_url} size='md' status={presenceOf(contact)} />
                <span className='contact-row__text'>
                  <span className='contact-row__name'>{contact.name}</span>
                  <span className={`contact-row__meta${presenceOf(contact) === 'online' ? ' is-online' : ''}`}>
                    {presenceLabel(presenceOf(contact), contact.last_seen_at)}
                  </span>
                </span>
              </button>
              <span className='contact-row__actions'>
                <Tooltip label='Message'>
                  <button
                    type='button'
                    className='contact-row__action'
                    onClick={() => openConversationWith(contact.id)}
                    aria-label={`Message ${contact.name}`}
                  >
                    <Icon name='chat' size={16} />
                  </button>
                </Tooltip>
                <Tooltip label='Remove from contacts'>
                  <button
                    type='button'
                    className='contact-row__action'
                    onClick={() => setRemoving(contact)}
                    aria-label={`Remove ${contact.name} from contacts`}
                  >
                    <Icon name='x' size={16} />
                  </button>
                </Tooltip>
              </span>
            </li>
          ))}
        </ul>
      )}

      {contacts.length > 0 && (
        <p className='contacts__footer'>
          {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} · {onlineCount} online
        </p>
      )}

      <ConfirmDialog
        open={removing !== null}
        icon='userMinus'
        title={removing ? `Remove ${removing.name}?` : ''}
        message='They’ll leave your contacts. Your conversation and its history stay.'
        confirmLabel='Remove'
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}

export default Contacts
