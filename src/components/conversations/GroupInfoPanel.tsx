import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { AxiosError } from 'axios'
import {
  addParticipant,
  deleteConversation,
  kickParticipant,
  leaveConversation,
  renameConversation,
  updateParticipantRole,
} from '../../services/api/conversations'
import { getContacts } from '../../services/api/contacts'
import { presenceLabel } from '../../utils/presence'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Icon from '../ui/Icon'
import Menu, { type MenuEntry } from '../ui/Menu'
import Modal from '../ui/Modal'
import PersonRow from './PersonRow'
import SoonActions from './SoonActions'
import type { ContactType, ConversationType } from '../../utils/baseTypes'

type Participant = NonNullable<ConversationType['participants']>[number]

type GroupInfoPanelProps = {
  conversation: ConversationType
  currentUserId: string
  /** The viewer has left or been removed: everything is look-only. */
  readOnly: boolean
}

type ApiError = AxiosError<{ data?: { message?: string } }>

const apiMessage = (err: ApiError, fallback: string) => err.response?.data?.data?.message ?? fallback

type OpenDialog = 'add' | 'leave' | 'hand-over' | 'delete' | { remove: Participant } | null

/**
 * Group info (Groups-Management, Groups-Roles). Shows exactly what the viewer
 * can do: admins get the rename field, Add people, a menu on each member and
 * Delete group; everyone else sees who's in the group and can leave.
 *
 * Every rule is the one the old settings dialog enforced, and the API
 * enforces again: only admins rename, add, remove and change roles; the last
 * admin can't be demoted, and can't leave while anyone else remains without
 * handing over first (here that's one step — pick a successor, and they're
 * made admin before you leave); the last member is warned there's no way
 * back in. Server refusals are shown in the server's own words.
 */
const GroupInfoPanel = ({ conversation, currentUserId, readOnly }: GroupInfoPanelProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [title, setTitle] = useState(conversation.title ?? '')
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const closeDialog = () => setDialog(null)

  const displayTitle = conversation.title || 'Untitled group'
  const participants = (conversation.participants ?? []).filter((p) => !p.left_at)
  const isAdmin = !readOnly && participants.some((p) => p.user_id === currentUserId && p.role === 'admin')
  const activeAdminCount = participants.filter((p) => p.role === 'admin').length
  const otherActive = participants.filter((p) => p.user_id !== currentUserId)
  const blockedFromLeaving = isAdmin && activeAdminCount <= 1 && otherActive.length > 0
  const isSoloMember = participants.length === 1
  const onlineCount = participants.filter((p) => p.is_online).length

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  const { mutate: kick, isPending: isKicking } = useMutation({
    mutationFn: (userId: string) => kickParticipant(conversation.id, userId),
    onSuccess: () => {
      invalidate()
      closeDialog()
    },
    onError: () => toast.error('Failed to remove participant. Please try again.'),
  })

  const { mutate: changeRole, isPending: isChangingRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'participant' }) =>
      updateParticipantRole(conversation.id, userId, role),
    onSuccess: invalidate,
    onError: (err: ApiError) => toast.error(apiMessage(err, 'Failed to update role. Please try again.')),
  })

  const { mutate: leave, isPending: isLeaving } = useMutation({
    mutationFn: () => leaveConversation(conversation.id, currentUserId),
    onSuccess: () => {
      invalidate()
      closeDialog()
    },
    onError: (err: ApiError) => toast.error(apiMessage(err, 'Failed to leave the group.')),
  })

  // The sole admin's way out, in one step: make the chosen member an admin,
  // then leave. If the promotion lands and the leave doesn't, the group is
  // left with two admins and the viewer can simply leave again.
  const { mutate: handOverAndLeave, isPending: isHandingOver } = useMutation({
    mutationFn: async (successorId: string) => {
      await updateParticipantRole(conversation.id, successorId, 'admin')
      await leaveConversation(conversation.id, currentUserId)
    },
    onSuccess: () => {
      invalidate()
      closeDialog()
    },
    onError: (err: ApiError) => {
      invalidate()
      toast.error(apiMessage(err, 'Failed to leave the group.'))
    },
  })

  const { mutate: deleteGroup, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteConversation(conversation.id),
    onSuccess: () => {
      invalidate()
      closeDialog()
      navigate('/conversations')
    },
    onError: () => toast.error('Failed to delete the group.'),
  })

  const { mutate: rename, isPending: isRenaming } = useMutation({
    mutationFn: (newTitle: string) => renameConversation(conversation.id, newTitle),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to rename the group.'),
  })

  const titleDirty = title.trim().length > 0 && title.trim() !== (conversation.title ?? '')

  return (
    <div className='group-info'>
      <div className='info-identity'>
        <Avatar name={displayTitle} kind='group' size='xl' />
        <p className='info-identity__name'>{displayTitle}</p>
        <p className='info-identity__meta'>
          {participants.length} {participants.length === 1 ? 'member' : 'members'} · {onlineCount} online
        </p>
      </div>

      <SoonActions />

      {isAdmin ? (
        <section className='admin-card' aria-labelledby='admin-controls-heading'>
          <h3 id='admin-controls-heading' className='admin-card__title'>
            <Icon name='shield' size={14} />
            Admin controls
          </h3>
          <form
            className='admin-card__rename'
            onSubmit={(e) => {
              e.preventDefault()
              if (titleDirty) rename(title.trim())
            }}
          >
            <label className='sr-only' htmlFor='group-rename'>
              Group name
            </label>
            <input
              id='group-rename'
              className='input'
              value={title}
              placeholder='Group name'
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button type='submit' variant='secondary' disabled={!titleDirty} loading={isRenaming}>
              Save
            </Button>
          </form>
          <Button variant='secondary' block onClick={() => setDialog('add')}>
            <Icon name='userPlus' size={16} />
            Add people
          </Button>
        </section>
      ) : (
        !readOnly && (
          <p className='info-note'>
            <Icon name='shield' size={14} />
            Only admins can rename the group or add and remove people.
          </p>
        )
      )}

      <section aria-labelledby='members-heading'>
        <h3 id='members-heading' className='info-section-title'>
          Members · {participants.length}
        </h3>
        <ul className='member-list'>
          {participants.map((p) => (
            <MemberRow
              key={p.user_id}
              participant={p}
              isSelf={p.user_id === currentUserId}
              canManage={isAdmin && p.user_id !== currentUserId}
              isSoleAdmin={p.role === 'admin' && activeAdminCount <= 1}
              busy={isChangingRole || isKicking}
              onToggleRole={() =>
                changeRole({ userId: p.user_id, role: p.role === 'admin' ? 'participant' : 'admin' })
              }
              onRemove={() => setDialog({ remove: p })}
            />
          ))}
        </ul>
      </section>

      {/* No endpoint lists a conversation's attachments yet. */}
      <div className='info-row is-disabled' aria-disabled='true'>
        <Icon name='image' size={16} />
        <span>Shared media</span>
        <Badge tone='needs-api'>Needs API</Badge>
      </div>

      {!readOnly && (
        <div className='info-danger-actions'>
          {blockedFromLeaving && (
            <p className='info-note is-warning'>
              You’re the only admin. Leaving asks you to pick someone to take over.
            </p>
          )}
          <button
            type='button'
            className='info-danger-btn'
            onClick={() => setDialog(blockedFromLeaving ? 'hand-over' : 'leave')}
          >
            <Icon name='logout' size={16} />
            Leave group
          </button>
          {isAdmin && (
            <button type='button' className='info-danger-btn' onClick={() => setDialog('delete')}>
              <Icon name='trash' size={16} />
              Delete group
            </button>
          )}
        </div>
      )}

      {/* ---- Dialogs ---- */}

      {isAdmin && (
        <AddPeopleDialog
          open={dialog === 'add'}
          conversation={conversation}
          groupTitle={displayTitle}
          memberIds={new Set(participants.map((p) => p.user_id))}
          onDone={invalidate}
          onClose={closeDialog}
        />
      )}

      <ConfirmDialog
        open={typeof dialog === 'object' && dialog !== null}
        icon='userMinus'
        title={typeof dialog === 'object' && dialog ? `Remove ${dialog.remove.name}?` : ''}
        message='They’ll lose access to new messages. Everyone will see a note that they were removed.'
        confirmLabel='Remove'
        loading={isKicking}
        onConfirm={() => typeof dialog === 'object' && dialog && kick(dialog.remove.user_id)}
        onCancel={closeDialog}
      />

      <ConfirmDialog
        open={dialog === 'leave'}
        icon='logout'
        title={isSoloMember ? 'Leave group?' : `Leave “${displayTitle}”?`}
        message={
          isSoloMember
            ? 'You’re the only member left in this group. If you leave, you won’t be able to rejoin — there’s no one left who could add you back.'
            : 'You’ll keep the history up to now but won’t be able to send messages or react.'
        }
        cancelLabel='Stay'
        confirmLabel={isSoloMember ? 'Leave anyway' : 'Leave group'}
        loading={isLeaving}
        onConfirm={() => leave()}
        onCancel={closeDialog}
      />

      {blockedFromLeaving && (
        <HandOverDialog
          open={dialog === 'hand-over'}
          candidates={otherActive}
          loading={isHandingOver}
          onConfirm={(successorId) => handOverAndLeave(successorId)}
          onCancel={closeDialog}
        />
      )}

      {isAdmin && (
        <DeleteGroupDialog
          open={dialog === 'delete'}
          title={conversation.title}
          displayTitle={displayTitle}
          memberCount={participants.length}
          loading={isDeleting}
          onConfirm={() => deleteGroup()}
          onCancel={closeDialog}
        />
      )}
    </div>
  )
}

/** A member, with a ⋯ menu for admins: Make/Remove admin, Remove from group. */
const MemberRow = ({
  participant: p,
  isSelf,
  canManage,
  isSoleAdmin,
  busy,
  onToggleRole,
  onRemove,
}: {
  participant: Participant
  isSelf: boolean
  canManage: boolean
  isSoleAdmin: boolean
  busy: boolean
  onToggleRole: () => void
  onRemove: () => void
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isAdmin = p.role === 'admin'

  const entries: MenuEntry[] = [
    {
      kind: 'item',
      id: 'role',
      label: isAdmin ? 'Remove admin' : 'Make admin',
      icon: isAdmin ? 'shieldMinus' : 'shieldPlus',
      // The API refuses to leave a group without an admin.
      disabled: busy || isSoleAdmin,
      onSelect: onToggleRole,
    },
    { kind: 'separator', id: 'sep' },
    { kind: 'item', id: 'remove', label: 'Remove from group', icon: 'userMinus', tone: 'danger', onSelect: onRemove },
  ]

  return (
    <li className={`member-list__item${menuOpen ? ' is-active' : ''}`}>
      <PersonRow
        name={p.name}
        avatarUrl={p.avatar_url}
        isOnline={p.is_online}
        lastSeenAt={p.last_seen_at}
        meta={isSelf ? `You · ${presenceLabel(p.is_online, p.last_seen_at)}` : undefined}
        trailing={
          <>
            {isAdmin && (
              <Badge tone='admin'>
                <Icon name='shield' size={11} />
                Admin
              </Badge>
            )}
            {canManage && (
              <button
                ref={triggerRef}
                type='button'
                className='member-list__menu-btn'
                aria-label={`Manage ${p.name}`}
                aria-haspopup='menu'
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Icon name='more' size={16} />
              </button>
            )}
          </>
        }
      />
      {canManage && (
        <Menu
          open={menuOpen}
          label={`Manage ${p.name}`}
          entries={entries}
          triggerRef={triggerRef}
          getAnchorRect={() => triggerRef.current?.getBoundingClientRect() ?? null}
          align='end'
          onClose={() => setMenuOpen(false)}
        />
      )}
    </li>
  )
}

/** Add people (Groups-Dialogs): contacts who aren't in the group yet. */
const AddPeopleDialog = ({
  open,
  conversation,
  groupTitle,
  memberIds,
  onDone,
  onClose,
}: {
  open: boolean
  conversation: ConversationType
  groupTitle: string
  memberIds: Set<string>
  onDone: () => void
  onClose: () => void
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    enabled: open,
  })
  const addable: ContactType[] = contacts.filter((u) => !memberIds.has(u.id))

  const close = () => {
    setSelected(new Set())
    onClose()
  }

  // One request per person (the API adds one at a time). Whoever couldn't
  // be added stays selected, so trying again only retries them.
  const { mutate: addPeople, isPending } = useMutation({
    mutationFn: async (userIds: string[]) => {
      const failed: string[] = []
      for (const userId of userIds) {
        try {
          await addParticipant(conversation.id, userId)
        } catch {
          failed.push(userId)
        }
      }
      return failed
    },
    onSuccess: (failed) => {
      onDone()
      if (failed.length === 0) {
        close()
      } else {
        setSelected(new Set(failed))
        toast.error('Failed to add participant. Please try again.')
      }
    },
  })

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const count = selected.size
  return (
    <Modal
      open={open}
      onClose={close}
      title={`Add people to ${groupTitle}`}
      description='Choose from your contacts who aren’t in the group yet.'
      icon='userPlus'
      footer={
        <>
          <Button variant='tertiary' onClick={close} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => addPeople(Array.from(selected))} disabled={count === 0} loading={isPending}>
            {count === 0 ? 'Add people' : `Add ${count} ${count === 1 ? 'person' : 'people'}`}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className='muted'>Loading…</p>
      ) : addable.length === 0 ? (
        <p className='muted'>No more people to add — everyone in your contacts is already here.</p>
      ) : (
        <ul className='people-list'>
          {addable.map((u) => (
            <li key={u.id}>
              <PersonRow
                name={u.name}
                avatarUrl={u.avatar_url}
                isOnline={u.is_online}
                lastSeenAt={u.last_seen_at}
                selected={selected.has(u.id)}
                control={<input type='checkbox' checked={selected.has(u.id)} onChange={() => toggle(u.id)} />}
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

/** The sole admin leaving: pick who takes over, then go (Groups-Dialogs). */
const HandOverDialog = ({
  open,
  candidates,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean
  candidates: Participant[]
  loading: boolean
  onConfirm: (successorId: string) => void
  onCancel: () => void
}) => {
  const [successorId, setSuccessorId] = useState<string | null>(null)
  const cancel = () => {
    setSuccessorId(null)
    onCancel()
  }

  return (
    <ConfirmDialog
      open={open}
      icon='shieldPlus'
      title='Choose a new admin first'
      message='You’re the only admin. Pick someone to take over before you leave.'
      confirmLabel='Make admin and leave'
      loading={loading}
      confirmDisabled={successorId === null}
      onConfirm={() => successorId && onConfirm(successorId)}
      onCancel={cancel}
    >
      <ul className='people-list' role='radiogroup' aria-label='New admin'>
        {candidates.map((p) => (
          <li key={p.user_id}>
            <PersonRow
              name={p.name}
              avatarUrl={p.avatar_url}
              isOnline={p.is_online}
              lastSeenAt={p.last_seen_at}
              selected={successorId === p.user_id}
              control={
                <input
                  type='radio'
                  name='successor'
                  checked={successorId === p.user_id}
                  onChange={() => setSuccessorId(p.user_id)}
                />
              }
            />
          </li>
        ))}
      </ul>
    </ConfirmDialog>
  )
}

/**
 * Delete group: removes it for every member, for good. A named group asks
 * for its name to be typed first (Groups-Dialogs); an untitled one has no
 * name to type, so it's the confirmation alone.
 */
const DeleteGroupDialog = ({
  open,
  title,
  displayTitle,
  memberCount,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  displayTitle: string
  memberCount: number
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) => {
  const [typed, setTyped] = useState('')
  const needsName = Boolean(title?.trim())
  const matches = !needsName || typed.trim().toLowerCase() === title!.trim().toLowerCase()
  const cancel = () => {
    setTyped('')
    onCancel()
  }

  return (
    <ConfirmDialog
      open={open}
      icon='trash'
      title={`Delete “${displayTitle}”?`}
      message={`The group and its messages are removed for all ${memberCount} ${memberCount === 1 ? 'member' : 'members'}. This can’t be undone.`}
      confirmLabel='Delete group'
      loading={loading}
      confirmDisabled={!matches}
      onConfirm={onConfirm}
      onCancel={cancel}
    >
      {needsName && (
        <div className='field'>
          <label className='field__label' htmlFor='delete-group-name'>
            Type the group name to confirm
          </label>
          <input
            id='delete-group-name'
            className='input'
            value={typed}
            autoComplete='off'
            placeholder={title}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      )}
    </ConfirmDialog>
  )
}

export default GroupInfoPanel
