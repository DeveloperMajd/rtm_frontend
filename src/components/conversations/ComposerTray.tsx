import Icon from '../ui/Icon'
import { MAX_ATTACHMENTS, formatBytes, splitFileName } from '../../utils/attachments'

export type PendingUpload = {
  id: string
  /** Kept so a failed upload can be retried without picking it again. */
  file: File
  name: string
  size: number
  isImage: boolean
  previewUrl?: string
  progress: number
  /** `rejected` never reaches the server: it failed a check before upload
   * and stays in the tray only to say why, until it's removed. */
  status: 'uploading' | 'done' | 'error' | 'rejected'
  rejection?: string
  attachmentId?: string
}

interface ComposerTrayProps {
  uploads: PendingUpload[]
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

/**
 * The files waiting to go with the next message (Attach-Composer): what each
 * one is, how far along its upload is, and what went wrong if it did.
 */
const ComposerTray = ({ uploads, onRemove, onRetry }: ComposerTrayProps) => (
  <div className='composer__tray'>
    <ul className='tray' aria-label='Attachments'>
      {uploads.map((upload) =>
        upload.isImage && upload.previewUrl && upload.status !== 'rejected' ? (
          <ImageItem key={upload.id} upload={upload} onRemove={onRemove} onRetry={onRetry} />
        ) : (
          <FileItem key={upload.id} upload={upload} onRemove={onRemove} onRetry={onRetry} />
        ),
      )}
    </ul>
    <span className='composer__count'>
      {uploads.length}/{MAX_ATTACHMENTS}
      <span className='sr-only'> files attached</span>
    </span>
  </div>
)

type ItemProps = { upload: PendingUpload; onRemove: (id: string) => void; onRetry: (id: string) => void }

const RemoveButton = ({ upload, onRemove }: Pick<ItemProps, 'upload' | 'onRemove'>) => (
  <button
    type='button'
    className='tray__remove'
    onClick={() => onRemove(upload.id)}
    aria-label={`Remove ${upload.name}`}
  >
    <Icon name='x' size={12} />
  </button>
)

/** Progress as a ring round the tile — a circle of circumference 100, so
 * the dash length is the percentage. */
const ProgressRing = ({ progress }: { progress: number }) => (
  <svg className='tray__ring' viewBox='0 0 36 36' aria-hidden='true'>
    <circle cx='18' cy='18' r='15.9155' className='tray__ring-track' />
    <circle
      cx='18'
      cy='18'
      r='15.9155'
      className='tray__ring-fill'
      strokeDasharray={`${progress} ${100 - progress}`}
    />
  </svg>
)

const ImageItem = ({ upload, onRemove, onRetry }: ItemProps) => (
  <li className={`tray__image is-${upload.status}`}>
    <img src={upload.previewUrl} alt={upload.name} />
    {upload.status === 'uploading' && (
      <span
        className='tray__overlay'
        role='progressbar'
        aria-label={`Uploading ${upload.name}`}
        aria-valuenow={upload.progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <ProgressRing progress={upload.progress} />
      </span>
    )}
    {upload.status === 'error' && (
      <button
        type='button'
        className='tray__overlay tray__retry'
        onClick={() => onRetry(upload.id)}
        aria-label={`Upload of ${upload.name} failed. Retry`}
      >
        <Icon name='refresh' size={16} />
        Retry
      </button>
    )}
    <RemoveButton upload={upload} onRemove={onRemove} />
  </li>
)

const FileItem = ({ upload, onRemove, onRetry }: ItemProps) => {
  const { base, ext } = splitFileName(upload.name)

  let meta: string = formatBytes(upload.size)
  if (upload.status === 'uploading') meta += ` · ${upload.progress}%`
  if (upload.status === 'error') meta = 'Upload failed'
  if (upload.status === 'rejected') meta = upload.rejection ?? 'Can’t be sent'

  const isProblem = upload.status === 'error' || upload.status === 'rejected'

  return (
    <li className={`tray__file is-${upload.status}`}>
      <span className='tray__file-icon'>
        <Icon name={isProblem ? 'alertCircle' : 'fileText'} size={16} />
      </span>
      <span className='tray__file-text'>
        <span className='tray__file-name' title={upload.name}>
          <span className='tray__file-base'>{base}</span>
          {ext}
        </span>
        <span className='tray__file-meta'>{meta}</span>
        {upload.status === 'uploading' && (
          <span
            className='tray__bar'
            role='progressbar'
            aria-label={`Uploading ${upload.name}`}
            aria-valuenow={upload.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${upload.progress}%` }} />
          </span>
        )}
      </span>
      {upload.status === 'error' && (
        <button type='button' className='tray__file-retry' onClick={() => onRetry(upload.id)}>
          Retry
        </button>
      )}
      <RemoveButton upload={upload} onRemove={onRemove} />
    </li>
  )
}

export default ComposerTray
