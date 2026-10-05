import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { QUICK_REACTIONS, reactionLabel } from '../../utils/reactions'
import {
  useAnchoredPopover,
  type AnchorRect,
  type PopoverAlign,
} from '../../hooks/useAnchoredPopover'

interface ReactionPickerProps {
  open: boolean
  /** Reactions the viewer has already placed — shown checked, and choosing
   * one again removes it. */
  mine: ReadonlySet<string>
  onToggle: (reaction: string, reacted: boolean) => void
  /** Whichever button opened the picker — focus returns there on close. */
  triggerRef: RefObject<HTMLElement | null>
  getAnchorRect: () => AnchorRect | null
  align: PopoverAlign
  onClose: () => void
}

/**
 * The six reactions the backend accepts, one tap to toggle
 * (Study-Reactions). A horizontal menu of checkbox items: ←/→ move (and
 * wrap), Home/End jump, Escape and Tab close, and each item says whether
 * it's already yours via `aria-checked` rather than by colour alone.
 */
const ReactionPicker = ({
  open,
  mine,
  onToggle,
  triggerRef,
  getAnchorRect,
  align,
  onClose,
}: ReactionPickerProps) => {
  const pickerRef = useRef<HTMLDivElement>(null)

  useAnchoredPopover({
    open,
    popoverRef: pickerRef,
    getAnchorRect,
    align,
    ignoreRefs: [triggerRef],
    onOutsidePointerDown: onClose,
  })

  useEffect(() => {
    if (open) {
      pickerRef.current?.querySelector<HTMLElement>('[role="menuitemcheckbox"]')?.focus()
    }
  }, [open])

  if (!open) return null

  const closeAndRestoreFocus = () => {
    onClose()
    triggerRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      pickerRef.current?.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]') ?? [],
    )
    const current = items.indexOf(document.activeElement as HTMLElement)
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus()

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusAt(current + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusAt(current - 1)
        break
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(items.length - 1)
        break
      case 'Escape':
      case 'Tab':
        event.preventDefault()
        event.stopPropagation()
        closeAndRestoreFocus()
        break
    }
  }

  return createPortal(
    <div
      ref={pickerRef}
      role='menu'
      aria-label='Add a reaction'
      aria-orientation='horizontal'
      className='reaction-picker'
      onKeyDown={handleKeyDown}
    >
      {QUICK_REACTIONS.map((emoji) => {
        const reacted = mine.has(emoji)
        return (
          <button
            key={emoji}
            type='button'
            role='menuitemcheckbox'
            aria-checked={reacted}
            aria-label={reactionLabel(emoji)}
            tabIndex={-1}
            className={`reaction-picker__item${reacted ? ' is-mine' : ''}`}
            onClick={() => {
              closeAndRestoreFocus()
              onToggle(emoji, reacted)
            }}
            onPointerEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
          >
            <span aria-hidden='true'>{emoji}</span>
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

export default ReactionPicker
