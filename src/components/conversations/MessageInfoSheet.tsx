import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import BottomSheet from '../ui/BottomSheet'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Skeleton from '../ui/Skeleton'
import useMessageInfo from '../../hooks/useMessageInfo'
import { previewOf } from '../../utils/messagePreview'
import type { MessageType } from '../../utils/baseTypes'
import type { Reader } from '../../utils/readReceipts'

interface MessageInfoSheetProps {
  open: boolean
  onClose: () => void
  message: MessageType
  isOwn: boolean
}

const when = (iso: string) => format(new Date(iso), 'd MMM yyyy, HH:mm')

/**
 * What the More menu's "Message info" opens: the message, when it was sent
 * and edited and, on your own, who has seen it and who hasn't yet. A sheet
 * on a phone and a dialog from 768px, like the long-press sheet.
 *
 * The facts are already on the message, so they show at once. Only who has
 * seen it needs the server, which applies the read-receipt rules.
 */
const MessageInfoSheet = ({ open, onClose, message, isOwn }: MessageInfoSheetProps) => (
  <BottomSheet open={open} onClose={onClose} title='Message info'>
    <figure className={`message-sheet__preview${isOwn ? ' is-own' : ''}`}>
      <blockquote>{previewOf(message)}</blockquote>
      <figcaption>{isOwn ? 'You' : (message.sender?.name ?? 'Unknown')}</figcaption>
    </figure>

    <dl className='info-facts'>
      <div>
        <dt>Sent</dt>
        <dd>
          <time dateTime={message.created_at}>{when(message.created_at)}</time>
        </dd>
      </div>
      {message.edited_at && (
        <div>
          <dt>Edited</dt>
          <dd>
            <time dateTime={message.edited_at}>{when(message.edited_at)}</time>
          </dd>
        </div>
      )}
    </dl>

    {isOwn && <SeenBy conversationId={message.conversation_id} messageId={message.id} />}
  </BottomSheet>
)

/**
 * Who has seen the viewer's message, in the rows the Seen by popover uses.
 * Seen or Not yet, and no time: the server knows when someone's pointer last
 * moved, not when they read this message (see ReadReceipt).
 *
 * The region stays put while its contents change, so a screen reader hears
 * the answer arrive.
 */
const SeenBy = ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
  const { data, isPending, isFetching, refetch } = useMessageInfo(conversationId, messageId, true)

  let content: ReactNode
  if (isPending) {
    content = (
      <ul className='seen-by__list' aria-hidden='true'>
        {[0, 1].map((row) => (
          <li key={row} className='seen-by__row'>
            <Skeleton variant='circle' width='2rem' height='2rem' />
            <Skeleton variant='line' width='40%' />
          </li>
        ))}
      </ul>
    )
  } else if (!data) {
    // Nothing to show yet: a failed refetch keeps the list it already has.
    content = (
      <>
        <p className='message-info__note'>Couldn’t load who has seen this.</p>
        <Button variant='secondary' className='sm' loading={isFetching} onClick={() => void refetch()}>
          Try again
        </Button>
      </>
    )
  } else if (data.read_by === null || data.not_read === null) {
    content = <p className='message-info__note'>Who has seen this isn’t available.</p>
  } else {
    content = <Readers seen={data.read_by} notYet={data.not_read} receiptsOff={data.receipts_off} />
  }

  return (
    <section className='message-info__seen' aria-label='Seen by' aria-live='polite' aria-busy={isPending}>
      {content}
    </section>
  )
}

/**
 * A read counts only if both people had read receipts on when it was made.
 * With the viewer's own off, what was read before they switched still
 * shows; the note says why nothing new will.
 */
const Readers = ({ seen, notYet, receiptsOff }: { seen: Reader[]; notYet: Reader[]; receiptsOff: boolean }) => {
  const total = seen.length + notYet.length

  if (total === 0) return <p className='message-info__note'>No one else is in this conversation.</p>

  const rows = [
    ...seen.map((reader) => ({ reader, hasSeen: true })),
    ...notYet.map((reader) => ({ reader, hasSeen: false })),
  ]

  return (
    <>
      <p className='seen-by__title'>{total > 1 ? `Seen by · ${seen.length} of ${total}` : 'Seen by'}</p>
      <ul className='seen-by__list'>
        {rows.map(({ reader, hasSeen }) => (
          <li key={reader.user_id} className={`seen-by__row${hasSeen ? '' : ' is-not-yet'}`}>
            <Avatar name={reader.name} src={reader.avatar_url} size='sm' />
            <span className='seen-by__name'>{reader.name}</span>
            <span className='seen-by__status'>{hasSeen ? 'Seen' : 'Not yet'}</span>
          </li>
        ))}
      </ul>
      {receiptsOff && (
        <p className='message-info__note'>
          Your read receipts are off, so reads from now on won’t show.{' '}
          <Link to='/settings#privacy'>Turn them on in Settings</Link>
        </p>
      )}
      {notYet.length > 0 && (
        <p className='message-info__note'>Anyone who read it while you or they had read receipts off shows as Not yet.</p>
      )}
    </>
  )
}

export default MessageInfoSheet
