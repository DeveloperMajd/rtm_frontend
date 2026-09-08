import type { AttachmentType } from '../../utils/baseTypes'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type MessageAttachmentProps = {
  attachment: AttachmentType
}

const MessageAttachment = ({ attachment }: MessageAttachmentProps) => {
  if (attachment.is_image) {
    return (
      <a
        href={attachment.url}
        target='_blank'
        rel='noreferrer'
        className='attachment-image block'
        title={attachment.original_name}
      >
        <img
          src={attachment.url}
          alt={attachment.original_name}
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
          loading='lazy'
          className='max-h-60 max-w-60 rounded border border-gray-200 object-cover'
        />
      </a>
    )
  }

  return (
    <a
      href={attachment.url}
      target='_blank'
      rel='noreferrer'
      className='attachment-file flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100'
    >
      <span aria-hidden>📄</span>
      <span className='flex flex-col overflow-hidden'>
        <span className='font-medium text-gray-700 truncate max-w-45'>
          {attachment.original_name}
        </span>
        <span className='text-xs text-gray-400'>{formatBytes(attachment.size_bytes)}</span>
      </span>
    </a>
  )
}

export default MessageAttachment
