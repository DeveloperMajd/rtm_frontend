import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import Icon from '../ui/Icon'

interface InfoPanelProps {
  id: string
  /** "Group info" or "Contact". */
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * The conversation's side panel (Groups-Management, Tablet-768-Info-Light).
 * From 1280px it docks beside the conversation; narrower, it slides over it
 * with a scrim behind — the same element either way, arranged by CSS.
 *
 * Not modal: the conversation stays usable beside it. Focus moves to its
 * heading when it opens, and Esc anywhere inside it closes it (the caller
 * puts focus back on the button that opened it).
 */
const InfoPanel = ({ id, title, onClose, children }: InfoPanelProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const headingId = useId()

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <>
      <div className='info-panel-scrim' onClick={onClose} aria-hidden='true' />
      <aside id={id} className='info-panel' aria-labelledby={headingId} onKeyDown={handleKeyDown}>
        <header className='info-panel__header'>
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className='info-panel__title'>
            {title}
          </h2>
          <button type='button' className='info-panel__close' onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            <Icon name='x' />
          </button>
        </header>
        <div className='info-panel__body scroll-y'>{children}</div>
      </aside>
    </>
  )
}

export default InfoPanel
