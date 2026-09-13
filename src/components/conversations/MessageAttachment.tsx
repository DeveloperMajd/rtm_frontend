import { mdiFileDocumentOutline } from '@mdi/js'
import Icon from '../ui/Icon'
import type { AttachmentType } from '../../utils/baseTypes'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Matches `.attachment__image`'s `max-width`/`max-height: 15rem` at the
// default root font size.
const MAX_PREVIEW_PX = 240

/** Scale (width, height) down to fit within MAX_PREVIEW_PX on both axes,
 * preserving aspect ratio, without ever upscaling a smaller image. */
function previewSize(
  width?: number | null,
  height?: number | null,
): { width: number; height: number } | null {
  if (!width || !height) return null
  const scale = Math.min(1, MAX_PREVIEW_PX / width, MAX_PREVIEW_PX / height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

const MessageAttachment = ({ attachment }: { attachment: AttachmentType }) => {
  if (attachment.is_image) {
    // Letterboxing an image via CSS `max-width` + `max-height` together
    // (with `width`/`height` left `auto`) is unreliable for portrait
    // photos — some browsers resolve both to their max value instead of
    // preserving the aspect ratio, stretching the image into a square. So
    // the target box is computed here instead and applied as an explicit
    // pixel size, which every browser sizes correctly.
    const size = previewSize(attachment.width, attachment.height)

    return (
      <a
        href={attachment.url}
        target='_blank'
        rel='noreferrer'
        className='attachment'
      >
        <img
          className='attachment__image'
          src={attachment.url}
          alt={attachment.original_name}
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
          style={size ? { width: size.width, height: size.height } : undefined}
          loading='lazy'
          decoding='async'
        />
      </a>
    )
  }

  return (
    <a href={attachment.url} target='_blank' rel='noreferrer' className='attachment__file'>
      <Icon path={mdiFileDocumentOutline} size={22} />
      <span style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <span className='truncate' style={{ fontWeight: 600 }}>
          {attachment.original_name}
        </span>
        <span className='muted' style={{ fontSize: '0.72rem' }}>
          {formatBytes(attachment.size_bytes)}
        </span>
      </span>
    </a>
  )
}

export default MessageAttachment
