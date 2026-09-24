import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import Badge from './Badge'
import type { IconName } from './icons'
import {
  useAnchoredPopover,
  type AnchorRect,
  type PopoverAlign,
} from '../../hooks/useAnchoredPopover'

export type MenuItemEntry = {
  kind: 'item'
  id: string
  label: string
  icon?: IconName
  /** Visible accelerator hint ("R", "⌘C"). Only give one that really works
   * — pair it with `matchesKey`. */
  shortcut?: string
  /** The same accelerator, in `aria-keyshortcuts` syntax ("R", "Meta+C"). */
  ariaKeyShortcuts?: string
  /** Activates this item when pressed while the menu is open. */
  matchesKey?: (event: KeyboardEvent) => boolean
  /** Not live yet. Renders the item disabled, with this tag beside it. */
  tag?: 'Soon' | 'Needs API'
  disabled?: boolean
  tone?: 'danger'
  onSelect?: () => void
}

export type MenuEntry = MenuItemEntry | { kind: 'separator'; id: string }

interface MenuProps {
  open: boolean
  /** Accessible name for the menu itself, e.g. "Message actions". */
  label: string
  entries: MenuEntry[]
  /** The button that opened it — focus goes back here on close. */
  triggerRef: RefObject<HTMLElement | null>
  getAnchorRect: () => AnchorRect | null
  align?: PopoverAlign
  onClose: () => void
  id?: string
}

const isItemDisabled = (entry: MenuItemEntry) => Boolean(entry.disabled || entry.tag)

/**
 * An action menu (WAI-ARIA menu pattern), opened from a menu button.
 *
 * Focus moves onto the first item when it opens and back to the trigger when
 * it closes by keyboard or by choosing an item. ↑/↓ move between items (and
 * wrap), Home/End jump, Escape and Tab close. Disabled items stay focusable,
 * as the pattern recommends, so a screen reader still hears that "Message
 * info — Soon" exists; they just can't be activated.
 *
 * Rendered in a portal and positioned against its anchor (see
 * useAnchoredPopover), so it's never clipped by a scrolling container.
 */
const Menu = ({
  open,
  label,
  entries,
  triggerRef,
  getAnchorRect,
  align = 'start',
  onClose,
  id,
}: MenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useAnchoredPopover({
    open,
    popoverRef: menuRef,
    getAnchorRect,
    align,
    ignoreRefs: [triggerRef],
    onOutsidePointerDown: onClose,
  })

  useEffect(() => {
    if (open) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }
  }, [open])

  if (!open) return null

  const closeAndRestoreFocus = () => {
    onClose()
    triggerRef.current?.focus()
  }

  const activate = (entry: MenuItemEntry) => {
    if (isItemDisabled(entry)) return
    // Close first, so an action that moves focus somewhere else (into the
    // composer, into a dialog) gets the last word.
    closeAndRestoreFocus()
    entry.onSelect?.()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    )
    const current = items.indexOf(document.activeElement as HTMLElement)
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus()

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusAt(current + 1)
        return
      case 'ArrowUp':
        event.preventDefault()
        focusAt(current - 1)
        return
      case 'Home':
        event.preventDefault()
        focusAt(0)
        return
      case 'End':
        event.preventDefault()
        focusAt(items.length - 1)
        return
      case 'Escape':
      case 'Tab':
        event.preventDefault()
        event.stopPropagation()
        closeAndRestoreFocus()
        return
    }

    const accelerated = entries.find(
      (entry): entry is MenuItemEntry =>
        entry.kind === 'item' && !isItemDisabled(entry) && Boolean(entry.matchesKey?.(event)),
    )
    if (accelerated) {
      event.preventDefault()
      activate(accelerated)
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role='menu'
      aria-label={label}
      className='menu'
      onKeyDown={handleKeyDown}
    >
      {entries.map((entry) => {
        if (entry.kind === 'separator') {
          return <div key={entry.id} role='separator' className='menu__separator' />
        }

        const disabled = isItemDisabled(entry)
        return (
          <button
            key={entry.id}
            type='button'
            role='menuitem'
            tabIndex={-1}
            className={`menu__item${entry.tone === 'danger' ? ' is-danger' : ''}`}
            aria-disabled={disabled || undefined}
            aria-keyshortcuts={entry.ariaKeyShortcuts}
            onClick={() => activate(entry)}
            // Pointer and keyboard share one highlight: hovering an item
            // focuses it, so ↑/↓ carry on from wherever the mouse left off.
            onPointerEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
          >
            {entry.icon && <Icon name={entry.icon} size={16} className='menu__icon' />}
            <span className='menu__label'>{entry.label}</span>
            {entry.tag && (
              <Badge tone={entry.tag === 'Soon' ? 'soon' : 'needs-api'}>{entry.tag}</Badge>
            )}
            {entry.shortcut && (
              <kbd className='menu__shortcut' aria-hidden='true'>
                {entry.shortcut}
              </kbd>
            )}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

export default Menu
