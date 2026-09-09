import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { addContact, searchUsers } from '../../services/api/contacts'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

interface AddContactModalProps {
  open: boolean
  onClose: () => void
  onAdded: (conversationId: string) => void
}

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
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['contacts', 'search', debounced],
    queryFn: () => searchUsers(debounced),
    enabled,
  })

  const add = useMutation({
    mutationFn: (userId: string) => addContact(userId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success(`${result.contact.name} added to contacts`)
      onAdded(result.conversation.id)
      handleClose()
    },
    onError: () => toast.error('Could not add contact'),
  })

  return (
    <Modal open={open} onClose={handleClose} title='Add a contact'>
      <div className='field'>
        <label className='field__label' htmlFor='contact-search'>
          Search by name or email
        </label>
        <input
          id='contact-search'
          className='input'
          type='search'
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. Jordan or jordan@example.com'
        />
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        {!enabled ? (
          <p className='muted' style={{ fontSize: '0.83rem' }}>
            Type at least 2 characters to search.
          </p>
        ) : isFetching ? (
          <p className='muted' style={{ fontSize: '0.83rem' }}>
            Searching…
          </p>
        ) : results.length === 0 ? (
          <p className='muted' style={{ fontSize: '0.83rem' }}>
            No one found. They may already be in your contacts.
          </p>
        ) : (
          <ul className='picker-list'>
            {results.map((u) => (
              <li key={u.id}>
                <div className='member-row'>
                  <span className='member-row__who'>
                    <Avatar name={u.name} src={u.avatar_url} size='sm' online={u.is_online} />
                    <span>{u.name}</span>
                  </span>
                  <span className='member-row__actions'>
                    <Button
                      variant='primary'
                      onClick={() => add.mutate(u.id)}
                      loading={add.isPending && add.variables === u.id}
                    >
                      Add
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

export default AddContactModal
