import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { addContact, searchUsers } from '../../services/api/contacts'
import ActionToast from '../ui/ActionToast'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import PersonRow from './PersonRow'

interface AddContactModalProps {
  open: boolean
  onClose: () => void
  onAdded: (conversationId: string) => void
}

/**
 * Add contact (Contacts-AddDialog): find someone by name or email and start
 * a direct chat with them straight away. The search only returns people who
 * aren't already contacts, and never their email address — it matches on
 * it, but the API doesn't hand it out.
 */
const AddContactModal = ({ open, onClose, onAdded }: AddContactModalProps) => {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const handleClose = () => {
    setQuery('')
    setDebounced('')
    onClose()
  }

  const enabled = open && debounced.length >= 2
  const { data: results = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['contacts', 'search', debounced],
    queryFn: () => searchUsers(debounced),
    enabled,
    retry: 1,
  })

  const add = useMutation({
    mutationFn: (userId: string) => addContact(userId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success(
        <span className='action-toast__text'>
          <strong>{result.contact.name} added</strong>
          <span>Opening your conversation…</span>
        </span>,
      )
      onAdded(result.conversation.id)
      handleClose()
    },
    onError: (_err, userId) =>
      toast.error((t) => (
        <ActionToast
          title='Could not add contact'
          body='Try again in a moment.'
          actionLabel='Retry'
          onAction={() => {
            toast.dismiss(t.id)
            add.mutate(userId)
          }}
        />
      )),
  })

  let body: ReactNode
  let status = ''
  if (!enabled) {
    body = (
      <>
        <p className='field__hint'>Type at least 2 characters.</p>
        <p className='dialog-placeholder'>Results appear here</p>
      </>
    )
  } else if (isLoading) {
    status = 'Searching…'
    body = (
      <div className='dialog-skeleton' aria-hidden='true'>
        {[0, 1, 2].map((i) => (
          <div key={i} className='dialog-skeleton__row'>
            <span className='skeleton skeleton--circle' />
            <span className='dialog-skeleton__lines'>
              <span className='skeleton skeleton--text' style={{ width: '40%' }} />
              <span className='skeleton skeleton--text' style={{ width: '60%' }} />
            </span>
          </div>
        ))}
      </div>
    )
  } else if (isError) {
    status = 'Couldn’t search right now.'
    body = (
      <div className='dialog-state'>
        <span className='dialog-state__icon is-danger'>
          <Icon name='alert' size={20} />
        </span>
        <p className='dialog-state__title'>Couldn’t search right now</p>
        <p className='dialog-state__text'>Your search is kept. Try again in a moment.</p>
        <Button variant='secondary' className='dialog-state__action' onClick={() => void refetch()}>
          <Icon name='refresh' size={14} />
          Try again
        </Button>
      </div>
    )
  } else if (results.length === 0) {
    status = 'No one found.'
    body = (
      <div className='dialog-state'>
        <span className='dialog-state__icon'>
          <Icon name='search' size={20} />
        </span>
        <p className='dialog-state__title'>No one found for “{debounced}”</p>
        <p className='dialog-state__text'>
          Check the spelling, or try their full email address. People already in your contacts
          don’t show up here.
        </p>
      </div>
    )
  } else {
    status = `${results.length} ${results.length === 1 ? 'person' : 'people'} found.`
    body = (
      <ul className='people-list'>
        {results.map((u) => (
          <li key={u.id}>
            <PersonRow
              name={u.name}
              avatarUrl={u.avatar_url}
              isOnline={u.is_online}
              lastSeenAt={u.last_seen_at}
              trailing={
                <Button
                  variant='secondary'
                  onClick={() => add.mutate(u.id)}
                  loading={add.isPending && add.variables === u.id}
                  disabled={add.isPending && add.variables !== u.id}
                  aria-label={`Add ${u.name}`}
                >
                  <Icon name='plus' size={14} />
                  Add
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title='Add contact'
      description='Find someone by name or email. You’ll start a direct chat right away.'
      icon='userPlus'
      footer={
        <Button variant='tertiary' onClick={handleClose}>
          Cancel
        </Button>
      }
    >
      <div className='field'>
        <label className='field__label' htmlFor='contact-search'>
          Name or email
        </label>
        <div className='input-with-icon'>
          <Icon name='search' size={16} />
          <input
            id='contact-search'
            className='input'
            type='search'
            autoComplete='off'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search people'
          />
        </div>
      </div>

      <div className='dialog-results'>{body}</div>
      <p className='sr-only' aria-live='polite'>
        {status}
      </p>
    </Modal>
  )
}

export default AddContactModal
