import { format } from 'date-fns'
import BottomSheet, { SheetAction } from '../ui/BottomSheet'
import { QUICK_REACTIONS, reactionLabel } from '../../utils/reactions'
import type { MessageType } from '../../utils/baseTypes'

interface MessageActionSheetProps {
  open: boolean
  onClose: () => void
  message: MessageType
  isOwn: boolean
  /** A group the viewer has left: nothing but Copy text. */
  readOnly: boolean
  /** Reactions the viewer has already placed. */
  mine: ReadonlySet<string>
  onToggleReaction: (reaction: string, reacted: boolean) => void
  onReply: () => void
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
}

/** The message a sheet is about, in a line or two. */
function previewOf(message: MessageType): string {
  if (message.body) return message.body
  const count = message.attachments?.length ?? 0
  if (count > 1) return `${count} attachments`
  const first = message.attachments?.[0]
  return first ? (first.is_image ? 'Photo' : first.original_name) : ''
}

/**
 * What a long press on a message opens on a touch screen
 * (Mobile-430-Message-Sheet): the six reactions along the top, the message
 * itself, then the same actions as the desktop More menu — the ones that
 * need an API first shown, disabled and tagged, never faked.
 */
const MessageActionSheet = ({
  open,
  onClose,
  message,
  isOwn,
  readOnly,
  mine,
  onToggleReaction,
  onReply,
  onCopy,
  onEdit,
  onDelete,
}: MessageActionSheetProps) => {
  // Each choice closes the sheet first, so focus is back in the
  // conversation before the action moves it on (into the composer, say).
  const choose = (action: () => void) => () => {
    onClose()
    action()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title='Message actions' hideTitle>
      {!readOnly && (
        <div className='message-sheet__reactions' role='group' aria-label='React'>
          {QUICK_REACTIONS.map((reaction) => {
            const reacted = mine.has(reaction)
            return (
              <button
                key={reaction}
                type='button'
                className={`message-sheet__reaction${reacted ? ' is-mine' : ''}`}
                aria-label={reactionLabel(reaction)}
                aria-pressed={reacted}
                onClick={choose(() => onToggleReaction(reaction, reacted))}
              >
                <span aria-hidden='true'>{reaction}</span>
              </button>
            )
          })}
        </div>
      )}

      <figure className={`message-sheet__preview${isOwn ? ' is-own' : ''}`}>
        <blockquote>{previewOf(message)}</blockquote>
        <figcaption>
          {isOwn ? 'You' : (message.sender?.name ?? 'Unknown')} ·{' '}
          <time dateTime={message.created_at}>{format(new Date(message.created_at), 'HH:mm')}</time>
        </figcaption>
      </figure>

      <div className='sheet-actions'>
        {!readOnly && <SheetAction icon='reply' label='Reply' onSelect={choose(onReply)} />}
        <SheetAction icon='copy' label='Copy text' disabled={!message.body} onSelect={choose(onCopy)} />
        {!readOnly && isOwn && <SheetAction icon='pencil' label='Edit' onSelect={choose(onEdit)} />}
        {!readOnly && <SheetAction icon='info' label='Message info' soon />}
        {!readOnly && !isOwn && (
          <>
            <SheetAction icon='link' label='Copy link' soon />
            <SheetAction icon='bookmark' label='Save message' soon />
          </>
        )}
        {!readOnly && isOwn && <SheetAction icon='trash' label='Delete' tone='danger' onSelect={choose(onDelete)} />}
      </div>
    </BottomSheet>
  )
}

export default MessageActionSheet
