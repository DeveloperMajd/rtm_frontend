import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { removeContact } from '../../services/api/contacts'
import useContacts from '../../hooks/useContacts'
import { presenceLabel } from '../../utils/presence'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import ConfirmDialog from '../ui/ConfirmDialog'
import Icon from '../ui/Icon'
import SoonActions from './SoonActions'
import type { ConversationType } from '../../utils/baseTypes'

type ContactInfoPanelProps = {
  conversation: ConversationType
  /** Every conversation the viewer is in — for the groups you share. */
  conversations: ConversationType[]
}

/**
 * Contact (Tablet-768-Info-Light, Contacts-1440's card): who this is, when
 * the conversation started, the groups you're both in, and — if they're in
 * your contacts — removing them. Their bio isn't exposed by the API, so
 * it's left out rather than faked.
 */
const ContactInfoPanel = ({ conversation, conversations }: ContactInfoPanelProps) => {
  const queryClient = useQueryClient()
  const { data: contacts = [] } = useContacts()
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const person = conversation.other_participant

  const { mutate: remove, isPending: isRemoving } = useMutation({
    mutationFn: (userId: string) => removeContact(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setConfirmingRemove(false)
    },
    onError: () => toast.error('Could not remove contact'),
  })

  if (!person) return null

  const isContact = contacts.some((c) => c.id === person.id)
  // Groups you're both active members of.
  const sharedGroups = conversations.filter(
    (c) =>
      c.type === 'group' &&
      !c.viewer_left_at &&
      (c.participants ?? []).some((p) => p.user_id === person.id && !p.left_at),
  )

  return (
    <div className='contact-info'>
      <div className='info-identity'>
        <Avatar name={person.name} src={person.avatar_url} size='xl' online={person.is_online} />
        <p className='info-identity__name'>{person.name}</p>
        <p className={`info-identity__meta${person.is_online ? ' is-online' : ''}`}>
          {presenceLabel(person.is_online, person.last_seen_at)}
        </p>
      </div>

      <SoonActions />

      <dl className='info-facts'>
        <div>
          <dt>Conversation</dt>
          <dd>Direct · since {format(new Date(conversation.created_at), 'd MMM yyyy')}</dd>
        </div>
        <div>
          <dt>Shared groups</dt>
          <dd>
            {sharedGroups.length === 0 ? (
              <span className='muted'>None</span>
            ) : (
              <ul className='info-links'>
                {sharedGroups.map((g) => (
                  <li key={g.id}>
                    <Link to={`/conversations/${g.id}`}>{g.title || 'Untitled group'}</Link>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      {/* No endpoint lists a conversation's attachments yet. */}
      <div className='info-row is-disabled' aria-disabled='true'>
        <Icon name='image' size={16} />
        <span>Shared media</span>
        <Badge tone='needs-api'>Needs API</Badge>
      </div>

      {isContact && (
        <div className='info-danger-actions'>
          <button type='button' className='info-danger-btn' onClick={() => setConfirmingRemove(true)}>
            <Icon name='userMinus' size={16} />
            Remove from contacts
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingRemove}
        icon='userMinus'
        title={`Remove ${person.name}?`}
        message='They’ll leave your contacts. Your conversation and its history stay.'
        confirmLabel='Remove'
        loading={isRemoving}
        onConfirm={() => remove(person.id)}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  )
}

export default ContactInfoPanel
