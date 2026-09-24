import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { format, isToday, isYesterday } from 'date-fns'
import toast from 'react-hot-toast'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { attachmentDownloadUrl, formatBytes, signedUrlExpiresAt } from '../../utils/attachments'
import type { AttachmentType } from '../../utils/baseTypes'

interface LightboxProps {
  images: AttachmentType[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  sender: { name: string; avatar_url?: string | null } | null
  sentAt: string
  /** See MessageAttachments — re-signs expired links, on request only. */
  onRefreshLinks: () => void
}

function sentLabel(iso: string): string {
  const d = new Date(iso)
  const time = format(d, 'HH:mm')
  if (isToday(d)) return `Today ${time}`
  if (isYesterday(d)) return `Yesterday ${time}`
  return `${format(d, 'd MMM')} ${time}`
}

/**
 * Full-screen viewer for one message's images (Attach-Lightbox): who sent
 * it and when, zoom, download, open in a new tab, ←/→ between the
 * message's images, and Esc to close. Modal in every sense — focus is
 * trapped inside and the app behind it is inert (useModalBehavior).
 *
 * Always dark, whatever the theme: a photo reads best against black.
 */
const Lightbox = ({ images, index, onIndexChange, onClose, sender, sentAt, onRefreshLinks }: LightboxProps) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [zoomed, setZoomed] = useState(false)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  useModalBehavior({ open: true, containerRef: dialogRef, onClose })

  const image = images[index]
  const count = images.length
  const hasPrev = index > 0
  const hasNext = index < count - 1

  const goTo = (next: number) => {
    if (next < 0 || next >= count) return
    setZoomed(false)
    onIndexChange(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A zoomed image scrolls with the arrow keys instead.
    if (zoomed) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goTo(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goTo(index + 1)
    }
  }

  const handleOpenInNewTab = (event: MouseEvent<HTMLAnchorElement>) => {
    const expiresAt = signedUrlExpiresAt(image.url)
    if (expiresAt !== null && Date.now() >= expiresAt) {
      event.preventDefault()
      onRefreshLinks()
      toast('That link had expired — fetching a fresh one. Try again in a moment.')
    }
  }

  return createPortal(
    <div
      ref={dialogRef}
      className='lightbox'
      role='dialog'
      aria-modal='true'
      aria-label={`Image viewer: ${image.original_name}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <header className='lightbox__bar'>
        <div className='lightbox__who'>
          <Avatar name={sender?.name ?? '?'} src={sender?.avatar_url} size='sm' />
          <div className='lightbox__who-text'>
            <span className='lightbox__sender'>{sender?.name ?? 'Unknown'}</span>
            <span className='lightbox__meta'>
              {image.original_name} · {sentLabel(sentAt)} · {formatBytes(image.size_bytes)}
            </span>
          </div>
        </div>

        <div className='lightbox__actions'>
          <button
            type='button'
            className='lightbox__icon-btn'
            aria-label={zoomed ? 'Fit to screen' : 'View actual size'}
            aria-pressed={zoomed}
            onClick={() => setZoomed((z) => !z)}
          >
            <Icon name='zoomIn' />
          </button>
          <a
            className='lightbox__icon-btn'
            href={attachmentDownloadUrl(image.id)}
            aria-label={`Download ${image.original_name}`}
          >
            <Icon name='download' />
          </a>
          <a
            className='lightbox__icon-btn'
            href={image.url}
            target='_blank'
            rel='noopener'
            aria-label='Open in a new tab'
            onClick={handleOpenInNewTab}
          >
            <Icon name='ext' />
          </a>
          <button type='button' className='lightbox__icon-btn' aria-label='Close' onClick={onClose}>
            <Icon name='x' />
          </button>
        </div>
      </header>

      <div
        className={`lightbox__stage${zoomed ? ' is-zoomed' : ''}`}
        // Clicking the empty space around the image closes, like a scrim.
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {failedUrl === image.url ? (
          <div className='lightbox__failed'>
            <Icon name='imageOff' size={28} />
            <span>Couldn’t load this image</span>
            <button
              type='button'
              className='lightbox__retry'
              onClick={() => {
                setFailedUrl(null)
                onRefreshLinks()
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <img
            key={image.url}
            src={image.url}
            alt={image.original_name}
            className='lightbox__image'
            onClick={() => setZoomed((z) => !z)}
            onError={() => setFailedUrl(image.url)}
          />
        )}

        {hasPrev && (
          <button
            type='button'
            className='lightbox__nav is-prev'
            aria-label='Previous image'
            onClick={() => goTo(index - 1)}
          >
            <Icon name='chevL' />
          </button>
        )}
        {hasNext && (
          <button
            type='button'
            className='lightbox__nav is-next'
            aria-label='Next image'
            onClick={() => goTo(index + 1)}
          >
            <Icon name='chevR' />
          </button>
        )}
      </div>

      <footer className='lightbox__footer'>
        {count > 1 && (
          <div className='lightbox__thumbs'>
            {images.map((thumb, i) => (
              <button
                key={thumb.id}
                type='button'
                className={`lightbox__thumb${i === index ? ' is-current' : ''}`}
                aria-label={`Image ${i + 1} of ${count}`}
                aria-current={i === index || undefined}
                onClick={() => goTo(i)}
              >
                <img src={thumb.url} alt='' />
              </button>
            ))}
          </div>
        )}
        <p className='lightbox__caption'>
          <span aria-live='polite'>
            {index + 1} of {count}
          </span>
          <span aria-hidden='true'>
            {count > 1 && ' · ← → to browse'} · Esc to close
          </span>
        </p>
      </footer>
    </div>,
    document.body,
  )
}

export default Lightbox
