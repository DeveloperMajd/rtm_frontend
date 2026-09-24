import { useId, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import type { MessageType } from '../../utils/baseTypes'
import { deleteMessage } from '../../services/api/messages'
import { markMessageDeletedInCache } from '../../utils/messagePages'
import { copyText } from '../../utils/clipboard'
import useAuth from '../../hooks/useAuth'
import useMessageReactions from '../../hooks/useMessageReactions'
import type { AnchorRect } from '../../hooks/useAnchoredPopover'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import ConfirmDialog from '../ui/ConfirmDialog'
import ActionToast from '../ui/ActionToast'
import MessageAttachments from './MessageAttachments'
import Lightbox from './Lightbox'
import MessageReactions from './MessageReactions'
import MessageToolbar from './MessageToolbar'
import MessageMenu from './MessageMenu'
import ReactionPicker from './ReactionPicker'

type MessageItemProps = {
  message: MessageType
  onReply: (message: MessageType) => void
  onEdit: (message: MessageType) => void
  grouped?: boolean
  readOnly?: boolean
  /** The viewer's newest message carries its delivery state
   * (Study-Read-State: "read state lives on your last message"). */
  showReadState?: boolean
}

/** Which popover is open, and — for the reaction picker — which button
 * opened it, so focus can go back to that one. */
type OpenPopover = 'menu' | 'react-toolbar' | 'react-row' | null

const MessageItem = ({
  message,
  onReply,
  onEdit,
  grouped = false,
  readOnly = false,
  showReadState = false,
}: MessageItemProps) => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { grouped: reactionGroups, toggleReaction } = useMessageReactions(message.id, message.reactions)
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const menuId = useId()

  const contentRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const reactButtonRef = useRef<HTMLButtonElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const addReactionButtonRef = useRef<HTMLButtonElement>(null)

  const isOwn = message.sender?.id === user?.id
  const isDeleted = Boolean(message.deleted_at)

  const attachments = message.attachments ?? []
  const images = attachments.filter((a) => a.is_image)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  // Attachment links are signed for 30 minutes when the page of messages is
  // fetched. Refetching the conversation is what re-signs them.
  const refreshLinks = () => {
    void queryClient.invalidateQueries({ queryKey: ['messages', message.conversation_id] })
  }

  const { mutate: removeMessage, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteMessage(message.id),
    onSuccess: () => {
      markMessageDeletedInCache(queryClient, message.conversation_id, message.id)
      setIsConfirmingDelete(false)
    },
    onError: () => {
      setIsConfirmingDelete(false)
      toast.error(
        (t) => (
          <ActionToast
            title='Couldn’t delete the message'
            body='It’s still there. Try again.'
            actionLabel='Retry'
            onAction={() => {
              toast.dismiss(t.id)
              removeMessage()
            }}
          />
        ),
        { id: `delete-failed-${message.id}` },
      )
    },
  })

  const handleCopy = () => {
    copyText(message.body)
      .then(() => toast.success('Message text copied'))
      .catch(() => toast.error('Couldn’t copy the text. Please try again.'))
  }

  const closePopover = () => setOpenPopover(null)
  const togglePopover = (popover: Exclude<OpenPopover, null>) =>
    setOpenPopover((current) => (current === popover ? null : popover))

  // The picker lines up with the bubble's outer edge and grows toward the
  // middle of the conversation, so it never runs off the screen edge the
  // bubble is pushed against.
  const pickerAlign = isOwn ? 'end' : 'start'

  /** Beside the toolbar horizontally, below the whole message (bubble and
   * reactions) vertically — or above the toolbar when there's no room. */
  const menuAnchor = (): AnchorRect | null => {
    const toolbar = toolbarRef.current?.getBoundingClientRect()
    const content = contentRef.current?.getBoundingClientRect()
    if (!toolbar || !content) return null
    return { top: toolbar.top, bottom: content.bottom, left: toolbar.left, right: toolbar.right }
  }

  const pickerAnchorFromToolbar = (): AnchorRect | null => {
    const toolbar = toolbarRef.current?.getBoundingClientRect()
    const bubble = bubbleRef.current?.getBoundingClientRect()
    const content = contentRef.current?.getBoundingClientRect()
    if (!toolbar || !bubble || !content) return null
    return { top: toolbar.top, bottom: content.bottom, left: bubble.left, right: bubble.right }
  }

  const pickerAnchorFromRow = (): AnchorRect | null =>
    addReactionButtonRef.current?.getBoundingClientRect() ?? null

  const isPickerOpen = openPopover === 'react-toolbar' || openPopover === 'react-row'
  const myReactions = new Set(
    Object.entries(reactionGroups)
      .filter(([, group]) => group.some((r) => r.user.id === user?.id))
      .map(([reaction]) => reaction),
  )

  const rowClass = [
    'msg-row',
    isOwn ? 'is-own' : 'is-other',
    grouped ? 'is-grouped' : '',
    // Keeps the toolbar showing while its menu or picker is open — focus
    // and the pointer have both moved into a popover outside the row.
    openPopover ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={rowClass}>
      <div className='msg-row__avatar-slot'>
        {!isOwn && !grouped && (
          <Avatar name={message.sender?.name ?? '?'} src={message.sender?.avatar_url} size='xs' />
        )}
      </div>

      <div ref={contentRef} className='msg-row__content'>
        <div ref={bubbleRef} className={`bubble${isDeleted ? ' is-deleted' : ''}`}>
          {!isOwn && !grouped && (
            <span className='bubble__sender'>{message.sender?.name ?? 'Unknown'}</span>
          )}

          {message.reply_to && !isDeleted && (
            <ReplyQuote replyTo={message.reply_to} viewerId={user?.id} />
          )}

          {/* Media first, the text beneath it as its caption
              (Attach-Messages). */}
          {!isDeleted && attachments.length > 0 && (
            <MessageAttachments
              attachments={attachments}
              onOpenImage={setViewerIndex}
              onRefreshLinks={refreshLinks}
            />
          )}

          {isDeleted ? (
            <span className='bubble__deleted'>
              <Icon name='ban' size={14} />
              This message was deleted
            </span>
          ) : (
            message.body && (
              <span className='bubble__body'>
                {message.body}
                {message.edited_at && <span className='bubble__edited'>edited</span>}
              </span>
            )
          )}

          {/* Every message shows its own send time, even tightly grouped
              ones — otherwise two messages minutes apart from the same
              sender would look like they were sent at the same instant.
              Only the sender name/avatar are suppressed when grouped. */}
          <span className='bubble__meta'>
            <time dateTime={message.created_at}>{format(new Date(message.created_at), 'HH:mm')}</time>
            {showReadState && !isDeleted && (
              <>
                <span aria-hidden='true'> · </span>
                {/* Sent is the only step this app can vouch for today:
                    every message on screen has been accepted by the server
                    (there's no optimistic send). Seen needs read pointers
                    exposed to clients — Phase 2. */}
                <span className='read-state'>
                  <span className='signal-bars read-state__bars' aria-hidden='true'>
                    <i className='is-lit' />
                    <i />
                    <i />
                  </span>
                  Sent
                </span>
              </>
            )}
          </span>

          {!isDeleted && (
            <MessageToolbar
              readOnly={readOnly}
              isReacting={openPopover === 'react-toolbar'}
              isMenuOpen={openPopover === 'menu'}
              menuId={menuId}
              toolbarRef={toolbarRef}
              reactButtonRef={reactButtonRef}
              moreButtonRef={moreButtonRef}
              onReact={() => togglePopover('react-toolbar')}
              onReply={() => onReply(message)}
              onMore={() => togglePopover('menu')}
            />
          )}
        </div>

        {!isDeleted && (
          <MessageReactions
            grouped={reactionGroups}
            viewerId={user?.id}
            readOnly={readOnly}
            onToggle={(reaction, reacted) => toggleReaction({ reaction, reacted })}
            onAdd={() => togglePopover('react-row')}
            addButtonRef={addReactionButtonRef}
            isAdding={openPopover === 'react-row'}
          />
        )}
      </div>

      {!isDeleted && (
        <>
          <MessageMenu
            open={openPopover === 'menu'}
            id={menuId}
            isOwn={isOwn}
            readOnly={readOnly}
            hasText={Boolean(message.body)}
            triggerRef={moreButtonRef}
            getAnchorRect={menuAnchor}
            // Hangs from the toolbar back across the bubble
            // (Study-Toolbar-Menu), whichever corner the toolbar is on.
            align={isOwn ? 'start' : 'end'}
            onClose={closePopover}
            onReply={() => onReply(message)}
            onCopy={handleCopy}
            onReact={() => setOpenPopover('react-toolbar')}
            onEdit={() => onEdit(message)}
            onDelete={() => setIsConfirmingDelete(true)}
          />

          <ReactionPicker
            open={isPickerOpen}
            mine={myReactions}
            onToggle={(reaction, reacted) => toggleReaction({ reaction, reacted })}
            triggerRef={openPopover === 'react-row' ? addReactionButtonRef : reactButtonRef}
            getAnchorRect={openPopover === 'react-row' ? pickerAnchorFromRow : pickerAnchorFromToolbar}
            align={pickerAlign}
            onClose={closePopover}
          />
        </>
      )}

      {viewerIndex !== null && images[viewerIndex] && (
        <Lightbox
          images={images}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          sender={message.sender}
          sentAt={message.created_at}
          onRefreshLinks={refreshLinks}
        />
      )}

      {isOwn && (
        <ConfirmDialog
          open={isConfirmingDelete}
          title='Delete this message?'
          message='It will show as deleted for everyone in the conversation. This can’t be undone.'
          confirmLabel='Delete'
          loading={isDeleting}
          onConfirm={() => removeMessage()}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </li>
  )
}

/**
 * The message a reply quotes, inside the reply's own bubble. Copes with a
 * deleted original and with one that was only attachments. Not tappable
 * yet: jumping to the original needs a message-context endpoint (Phase 2).
 */
const ReplyQuote = ({
  replyTo,
  viewerId,
}: {
  replyTo: NonNullable<MessageType['reply_to']>
  viewerId: string | undefined
}) => {
  const author =
    replyTo.sender?.id === viewerId ? 'You' : (replyTo.sender?.name ?? 'Unknown')
  const attachments = replyTo.attachments_count ?? 0

  let text: ReactNode = null
  if (replyTo.deleted_at) {
    text = <em>Original message deleted</em>
  } else if (replyTo.body) {
    text = replyTo.body
  } else if (attachments > 0) {
    text = (
      <>
        <Icon name='clip' size={12} />
        {attachments === 1 ? 'Attachment' : `${attachments} attachments`}
      </>
    )
  }

  return (
    <span className='bubble__quote'>
      <span className='bubble__quote-author'>
        <Icon name='reply' size={12} />
        {author}
      </span>
      {text && <span className='bubble__quote-text'>{text}</span>}
    </span>
  )
}

export default MessageItem
