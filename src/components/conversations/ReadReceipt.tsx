import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import type { Reader, Receipt } from '../../utils/readReceipts'
import Avatar from '../ui/Avatar'

/** Faces shown beside "Seen by N" before the rest are left to the list. */
const FACES = 3

/** The read-state glyph: signal bars, one lit for Sent, three for Seen
 * (Study-Read-State "Ladder"). */
const Bars = ({ lit }: { lit: 1 | 3 }) => (
  <span className='signal-bars read-state__bars' aria-hidden='true'>
    <i className='is-lit' />
    <i className={lit === 3 ? 'is-lit' : undefined} />
    <i className={lit === 3 ? 'is-lit' : undefined} />
  </span>
)

/**
 * Read state on the viewer's newest message (Study-Read-State): "Sent"
 * until someone has read it; then "Seen" in a direct conversation, or
 * "Seen by N" in a group — a button whose list says who has and who
 * hasn't yet.
 *
 * No time beside each name: the server knows when someone's pointer last
 * moved, not when they read this particular message, and a time that
 * could belong to a later message would be a guess dressed up as a fact.
 */
const ReadReceipt = ({ receipt }: { receipt: Receipt }) => {
  if (receipt.kind === 'sent') {
    return (
      <span className='read-state'>
        <Bars lit={1} />
        Sent
      </span>
    )
  }

  if (receipt.kind === 'seen') {
    return (
      <span className='read-state is-seen'>
        <Bars lit={3} />
        Seen
      </span>
    )
  }

  return <SeenBy seen={receipt.seen} notYet={receipt.notYet} />
}

const SeenBy = ({ seen, notYet }: { seen: Reader[]; notYet: Reader[] }) => {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const total = seen.length + notYet.length

  useAnchoredPopover({
    open: isOpen,
    popoverRef: listRef,
    getAnchorRect: () => buttonRef.current?.getBoundingClientRect() ?? null,
    // The viewer's own messages sit on the right, so the list hangs from
    // the button's right edge back across the conversation.
    align: 'end',
    ignoreRefs: [buttonRef],
    onOutsidePointerDown: () => setIsOpen(false),
  })

  useEffect(() => {
    if (isOpen) listRef.current?.focus()
  }, [isOpen])

  const close = () => {
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        className='read-state is-seen read-state__button'
        aria-label={`Seen by ${seen.length} of ${total} — show who`}
        aria-haspopup='dialog'
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
      >
        <Bars lit={3} />
        <span className='read-state__faces' aria-hidden='true'>
          {seen.slice(0, FACES).map((reader) => (
            <Avatar key={reader.user_id} name={reader.name} src={reader.avatar_url} size='xs' className='read-state__face' />
          ))}
        </span>
        Seen by {seen.length}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role='dialog'
            aria-label='Seen by'
            tabIndex={-1}
            className='menu seen-by'
            onKeyDown={handleKeyDown}
          >
            <p className='seen-by__title'>
              Seen by · {seen.length} of {total}
            </p>
            <ul className='seen-by__list'>
              {[...seen.map((r) => ({ reader: r, hasSeen: true })), ...notYet.map((r) => ({ reader: r, hasSeen: false }))].map(
                ({ reader, hasSeen }) => (
                  <li key={reader.user_id} className={`seen-by__row${hasSeen ? '' : ' is-not-yet'}`}>
                    <Avatar name={reader.name} src={reader.avatar_url} size='sm' />
                    <span className='seen-by__name'>{reader.name}</span>
                    <span className='seen-by__status'>{hasSeen ? 'Seen' : 'Not yet'}</span>
                  </li>
                ),
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}

export default ReadReceipt
