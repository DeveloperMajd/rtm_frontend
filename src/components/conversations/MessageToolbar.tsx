import { useState, type KeyboardEvent, type RefObject } from 'react'
import Icon from '../ui/Icon'
import Tooltip from '../ui/Tooltip'
import type { IconName } from '../ui/icons'

interface MessageToolbarProps {
  /** A left/read-only group: React and Reply stay visible but disabled, and
   * More holds only Copy text. */
  readOnly: boolean
  isReacting: boolean
  isMenuOpen: boolean
  menuId: string
  toolbarRef: RefObject<HTMLDivElement | null>
  reactButtonRef: RefObject<HTMLButtonElement | null>
  moreButtonRef: RefObject<HTMLButtonElement | null>
  onReact: () => void
  onReply: () => void
  onMore: () => void
}

type ButtonKey = 'react' | 'reply' | 'more'

type ToolbarButton = {
  key: ButtonKey
  icon: IconName
  label: string
  tooltip: string
  disabled?: boolean
  onClick: () => void
  expanded?: boolean
  controls?: string
}

/**
 * React · Reply · More, floating on the bubble's inner top corner
 * (Study-Toolbar-Menu). It fades in on hover or keyboard focus without
 * moving the layout.
 *
 * A single tab stop (WAI-ARIA toolbar pattern): Tab lands on one button and
 * ←/→/Home/End move within the toolbar, so tabbing down a conversation
 * costs one stop per message rather than three. R replies from anywhere in
 * it, matching the shortcut the More menu advertises.
 */
const MessageToolbar = ({
  readOnly,
  isReacting,
  isMenuOpen,
  menuId,
  toolbarRef,
  reactButtonRef,
  moreButtonRef,
  onReact,
  onReply,
  onMore,
}: MessageToolbarProps) => {
  const [activeKey, setActiveKey] = useState<ButtonKey>('react')

  const buttons: ToolbarButton[] = [
    {
      key: 'react',
      icon: 'smilePlus',
      label: 'Add reaction',
      tooltip: 'React',
      disabled: readOnly,
      onClick: onReact,
      expanded: isReacting,
    },
    { key: 'reply', icon: 'reply', label: 'Reply', tooltip: 'Reply (R)', disabled: readOnly, onClick: onReply },
    {
      key: 'more',
      icon: 'more',
      label: 'More actions',
      tooltip: 'More',
      onClick: onMore,
      expanded: isMenuOpen,
      controls: isMenuOpen ? menuId : undefined,
    },
  ]

  const enabledKeys = buttons.filter((b) => !b.disabled).map((b) => b.key)
  const tabStop = enabledKeys.includes(activeKey) ? activeKey : enabledKeys[0]

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = Array.from(
      toolbarRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    )
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement)
    const moveTo = (i: number) => enabled[(i + enabled.length) % enabled.length]?.focus()

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        moveTo(index + 1)
        return
      case 'ArrowLeft':
        event.preventDefault()
        moveTo(index - 1)
        return
      case 'Home':
        event.preventDefault()
        moveTo(0)
        return
      case 'End':
        event.preventDefault()
        moveTo(enabled.length - 1)
        return
    }

    const plainR =
      event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey
    if (plainR && !readOnly) {
      event.preventDefault()
      onReply()
    }
  }

  return (
    <div
      ref={toolbarRef}
      role='toolbar'
      aria-label='Message actions'
      className='msg-toolbar'
      onKeyDown={handleKeyDown}
    >
      {buttons.map((button) => (
        <Tooltip key={button.key} label={button.tooltip}>
          <button
            ref={
              button.key === 'react' ? reactButtonRef : button.key === 'more' ? moreButtonRef : undefined
            }
            type='button'
            className='msg-toolbar__btn'
            aria-label={button.label}
            aria-haspopup={button.expanded !== undefined ? 'menu' : undefined}
            aria-expanded={button.expanded}
            aria-controls={button.controls}
            disabled={button.disabled}
            tabIndex={button.key === tabStop ? 0 : -1}
            onFocus={() => setActiveKey(button.key)}
            onClick={button.onClick}
          >
            <Icon name={button.icon} size={16} />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}

export default MessageToolbar
