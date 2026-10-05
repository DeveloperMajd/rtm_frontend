import type { KeyboardEvent, RefObject } from 'react'
import Menu, { type MenuEntry, type MenuItemEntry } from '../ui/Menu'
import { IS_MAC_LIKE } from '../../utils/clipboard'
import type { AnchorRect, PopoverAlign } from '../../hooks/useAnchoredPopover'

interface MessageMenuProps {
  open: boolean
  id: string
  isOwn: boolean
  readOnly: boolean
  /** A message with no text (attachments only) has nothing to copy. */
  hasText: boolean
  triggerRef: RefObject<HTMLElement | null>
  getAnchorRect: () => AnchorRect | null
  align: PopoverAlign
  onClose: () => void
  onReply: () => void
  onCopy: () => void
  onReact: () => void
  onEdit: () => void
  onDelete: () => void
}

const noModifiers = (e: KeyboardEvent) => !e.metaKey && !e.ctrlKey && !e.altKey

/**
 * The More menu (Study-Toolbar-Menu). Someone else's message offers Reply,
 * Copy text and React; your own swaps React for Edit and adds Delete. The
 * features that need an API first stay visible, disabled and tagged Soon —
 * never faked. A read-only group keeps only Copy text.
 */
const MessageMenu = ({
  open,
  id,
  isOwn,
  readOnly,
  hasText,
  triggerRef,
  getAnchorRect,
  align,
  onClose,
  onReply,
  onCopy,
  onReact,
  onEdit,
  onDelete,
}: MessageMenuProps) => {
  const reply: MenuItemEntry = {
    kind: 'item',
    id: 'reply',
    label: 'Reply',
    icon: 'reply',
    shortcut: 'R',
    ariaKeyShortcuts: 'R',
    matchesKey: (e) => noModifiers(e) && e.key.toLowerCase() === 'r',
    onSelect: onReply,
  }
  const copy: MenuItemEntry = {
    kind: 'item',
    id: 'copy',
    label: 'Copy text',
    icon: 'copy',
    shortcut: IS_MAC_LIKE ? '⌘C' : 'Ctrl+C',
    ariaKeyShortcuts: IS_MAC_LIKE ? 'Meta+C' : 'Control+C',
    matchesKey: (e) =>
      (IS_MAC_LIKE ? e.metaKey : e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'c',
    disabled: !hasText,
    onSelect: onCopy,
  }
  const react: MenuItemEntry = {
    kind: 'item',
    id: 'react',
    label: 'React',
    icon: 'smilePlus',
    onSelect: onReact,
  }
  const edit: MenuItemEntry = { kind: 'item', id: 'edit', label: 'Edit', icon: 'pencil', onSelect: onEdit }
  const info: MenuItemEntry = { kind: 'item', id: 'info', label: 'Message info', icon: 'info', tag: 'Soon' }
  const link: MenuItemEntry = { kind: 'item', id: 'link', label: 'Copy link', icon: 'link', tag: 'Soon' }
  const save: MenuItemEntry = {
    kind: 'item',
    id: 'save',
    label: 'Save message',
    icon: 'bookmark',
    tag: 'Soon',
  }
  const remove: MenuItemEntry = {
    kind: 'item',
    id: 'delete',
    label: 'Delete',
    icon: 'trash',
    tone: 'danger',
    onSelect: onDelete,
  }

  let entries: MenuEntry[]
  if (readOnly) {
    entries = [copy]
  } else if (isOwn) {
    entries = [
      reply,
      copy,
      edit,
      { kind: 'separator', id: 'sep-soon' },
      info,
      { kind: 'separator', id: 'sep-danger' },
      remove,
    ]
  } else {
    entries = [reply, copy, react, { kind: 'separator', id: 'sep-soon' }, info, link, save]
  }

  return (
    <Menu
      open={open}
      id={id}
      label='Message actions'
      entries={entries}
      triggerRef={triggerRef}
      getAnchorRect={getAnchorRect}
      align={align}
      onClose={onClose}
    />
  )
}

export default MessageMenu
