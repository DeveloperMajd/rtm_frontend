import type { AttachmentType } from '../../utils/baseTypes'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const MessageAttachment = ({ attachment }: { attachment: AttachmentType }) => {
  if (attachment.is_image) {
    return (
      <a
        href={attachment.url}
        target='_blank'
        rel='noreferrer'
        className='attachment'
        title={attachment.original_name}
      >
        <img
          className='attachment__image'
          src={attachment.url}
          alt={attachment.original_name}
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
          loading='lazy'
          decoding='async'
        />
      </a>
    )
  }

  return (
    <a href={attachment.url} target='_blank' rel='noreferrer' className='attachment__file'>
      <span aria-hidden='true'>📄</span>
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
