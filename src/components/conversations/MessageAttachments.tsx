import { useState, type MouseEvent } from 'react'
import Icon from '../ui/Icon'
import type { AttachmentType } from '../../utils/baseTypes'
import {
  attachmentDownloadUrl,
  fileKindLabel,
  formatBytes,
  signedUrlExpiresAt,
  splitFileName,
} from '../../utils/attachments'

interface MessageAttachmentsProps {
  attachments: AttachmentType[]
  /** Opens the lightbox at this image (an index into the images only). */
  onOpenImage: (index: number) => void
  /** Re-fetch the conversation, which re-signs every attachment link — the
   * way out of an expired one. Only ever called from a click, never on its
   * own, so a link that keeps failing can't turn into a refetch loop. */
  onRefreshLinks: () => void
}

/**
 * A message's attachments (Attach-Messages): images as a grid that holds
 * its shape while loading, then one card per file.
 */
const MessageAttachments = ({ attachments, onOpenImage, onRefreshLinks }: MessageAttachmentsProps) => {
  const images = attachments.filter((a) => a.is_image)
  const files = attachments.filter((a) => !a.is_image)

  return (
    <div className='bubble__attachments'>
      {images.length > 0 && (
        <ImageGrid images={images} onOpen={onOpenImage} onRefreshLinks={onRefreshLinks} />
      )}
      {files.map((file) => (
        <FileCard key={file.id} attachment={file} onRefreshLinks={onRefreshLinks} />
      ))}
    </div>
  )
}

// The single-image preview box: the image's own aspect, scaled down to fit
// inside this square, never up. Explicit pixel sizes rather than max-width +
// max-height — some browsers resolve both to their max for portrait photos
// and stretch them into a square.
const SINGLE_MAX_PX = 320
const VISIBLE_TILES = 4

function singleImageSize(width?: number | null, height?: number | null) {
  if (!width || !height) return { width: 240, height: 180 }
  const scale = Math.min(1, SINGLE_MAX_PX / width, SINGLE_MAX_PX / height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** 1 image at its own aspect; 2 side by side; 3 as one large and two
 * stacked; 4 or more as a 2×2 grid, the last tile showing "+N". */
const ImageGrid = ({
  images,
  onOpen,
  onRefreshLinks,
}: {
  images: AttachmentType[]
  onOpen: (index: number) => void
  onRefreshLinks: () => void
}) => {
  const visible = images.slice(0, VISIBLE_TILES)
  const overflow = images.length - visible.length
  const single = images.length === 1 ? singleImageSize(images[0].width, images[0].height) : undefined

  return (
    <div className={`media-grid media-grid--${visible.length}`} style={single}>
      {visible.map((image, i) => (
        <ImageTile
          key={image.id}
          image={image}
          overflow={i === visible.length - 1 ? overflow : 0}
          onOpen={() => onOpen(i)}
          onRefreshLinks={onRefreshLinks}
        />
      ))}
    </div>
  )
}

const ImageTile = ({
  image,
  overflow,
  onOpen,
  onRefreshLinks,
}: {
  image: AttachmentType
  overflow: number
  onOpen: () => void
  onRefreshLinks: () => void
}) => {
  // Keyed by URL, so a freshly signed link (after a refresh) starts over as
  // "loading" rather than inheriting the old one's failure.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  if (failedUrl === image.url) {
    return (
      <div className='media-tile is-failed'>
        <Icon name='imageOff' size={20} />
        <span>Couldn’t load</span>
        <button
          type='button'
          className='media-tile__retry'
          aria-label={`Retry loading ${image.original_name}`}
          onClick={() => {
            setFailedUrl(null)
            setAttempt((n) => n + 1)
            // Most likely the 30-minute link has expired: ask for fresh ones.
            onRefreshLinks()
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <button
      type='button'
      className={`media-tile${loadedUrl === image.url ? ' is-loaded' : ''}`}
      aria-label={overflow > 0 ? `Open ${image.original_name}, and ${overflow} more` : `Open ${image.original_name}`}
      onClick={onOpen}
    >
      <img
        key={`${image.url}#${attempt}`}
        src={image.url}
        alt=''
        loading='lazy'
        decoding='async'
        onLoad={() => setLoadedUrl(image.url)}
        onError={() => setFailedUrl(image.url)}
      />
      {overflow > 0 && (
        <span className='media-tile__more' aria-hidden='true'>
          +{overflow}
        </span>
      )}
    </button>
  )
}

/**
 * A file: type icon, middle-truncated name, kind and size, and a download
 * button. Opening it uses the message's signed link; if that has expired by
 * the time it's clicked (a tab left open), the card says so and offers a
 * Reload instead of opening a dead link.
 */
const FileCard = ({ attachment, onRefreshLinks }: { attachment: AttachmentType; onRefreshLinks: () => void }) => {
  const [expiredUrl, setExpiredUrl] = useState<string | null>(null)
  const expired = expiredUrl === attachment.url
  const { base, ext } = splitFileName(attachment.original_name)

  const name = (
    <span className='file-card__name' title={attachment.original_name}>
      <span className='file-card__base'>{base}</span>
      {ext}
    </span>
  )

  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    const expiresAt = signedUrlExpiresAt(attachment.url)
    if (expiresAt !== null && Date.now() >= expiresAt) {
      event.preventDefault()
      setExpiredUrl(attachment.url)
    }
  }

  if (expired) {
    return (
      <div className='file-card is-expired'>
        <span className='file-card__icon'>
          <Icon name='lock' size={18} />
        </span>
        <span className='file-card__main'>
          {name}
          <span className='file-card__meta'>Link expired</span>
        </span>
        <button type='button' className='file-card__action is-labelled' onClick={onRefreshLinks}>
          <Icon name='refresh' size={14} />
          Reload
        </button>
      </div>
    )
  }

  return (
    <div className='file-card'>
      <span className='file-card__icon'>
        <Icon name='fileText' size={18} />
      </span>
      <a
        className='file-card__main'
        href={attachment.url}
        target='_blank'
        rel='noopener'
        onClick={handleOpen}
      >
        {name}
        <span className='file-card__meta'>
          {fileKindLabel(attachment.mime_type, attachment.original_name)} · {formatBytes(attachment.size_bytes)}
        </span>
      </a>
      <a
        className='file-card__action'
        href={attachmentDownloadUrl(attachment.id)}
        aria-label={`Download ${attachment.original_name}`}
      >
        <Icon name='download' size={16} />
      </a>
    </div>
  )
}

export default MessageAttachments
