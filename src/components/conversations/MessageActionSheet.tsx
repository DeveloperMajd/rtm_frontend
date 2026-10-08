import { format } from 'date-fns'
import BottomSheet, { SheetAction } from '../ui/BottomSheet'
import { QUICK_REACTIONS, reactionLabel } from '../../utils/reactions'
import { previewOf } from '../../utils/messagePreview'
import type { MessageType } from '../../utils/baseTypes'

interface MessageActionSheetProps {
  open: boolean
  onClose: () => void
  message: MessageType
  isOwn: boolean
  /** A group the viewer has left: nothing but Copy text. */
  readOnly: boolean
  /** Already on the viewer's Saved list: the action takes it off instead. */
  isSaved: boolean
  /** Reactions the viewer has already placed. */
  mine: ReadonlySet<string>
  onToggleReaction: (reaction: string, reacted: boolean) => void
  onReply: () => void
  onCopy: () => void
  onEdit: () => void
  onInfo: () => void
  onCopyLink: () => void
  onToggleSave: () => void
  onDelete: () => void
}

/**
 * What a long press on a message opens on a touch screen
 * (Mobile-430-Message-Sheet): the six reactions along the top, the message
 * itself, then the same actions as the desktop More menu.
 */
const MessageActionSheet = ({
  open,
  onClose,
  message,
  isOwn,
  readOnly,
  isSaved,
  mine,
  onToggleReaction,
  onReply,
  onCopy,
  onEdit,
  onInfo,
  onCopyLink,
  onToggleSave,
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
        {!readOnly && <SheetAction icon='info' label='Message info' onSelect={choose(onInfo)} />}
        {!readOnly && <SheetAction icon='link' label='Copy link' onSelect={choose(onCopyLink)} />}
        {!readOnly && (
          <SheetAction
            icon='bookmark'
            label={isSaved ? 'Remove from saved' : 'Save message'}
            onSelect={choose(onToggleSave)}
          />
        )}
        {!readOnly && isOwn && <SheetAction icon='trash' label='Delete' tone='danger' onSelect={choose(onDelete)} />}
      </div>
    </BottomSheet>
  )
}

export default MessageActionSheet
