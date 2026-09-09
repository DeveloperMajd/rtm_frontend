import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sendMessage, uploadAttachment } from '../../services/api/messages'
import { postTyping } from '../../services/api/conversations'
import type { MessageType } from '../../utils/baseTypes'

type MessageFormProps = {
  conversationId: string
  replyingTo: MessageType | null
  onCancelReply: () => void
}

type PendingUpload = {
  id: string
  name: string
  isImage: boolean
  previewUrl?: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  attachmentId?: string
}

const TYPING_THROTTLE_MS = 2000
const MAX_ATTACHMENTS = 10
const MAX_FILE_BYTES = 15 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

const MessageForm = ({ conversationId, replyingTo, onCancelReply }: MessageFormProps) => {
  const [body, setBody] = useState('')
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const queryClient = useQueryClient()
  const typingThrottle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadsRef = useRef<PendingUpload[]>([])

  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads])

  useEffect(() => {
    return () => {
      uploadsRef.current.forEach((upload) => {
        if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl)
      })
    }
  }, [])

  const clearUploads = () => {
    setUploads((current) => {
      current.forEach((upload) => {
        if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl)
      })
      return []
    })
  }

  const { mutate, isPending } = useMutation({
    mutationFn: ({ text, attachmentIds }: { text: string; attachmentIds: string[] }) =>
      sendMessage(conversationId, text, replyingTo?.id, attachmentIds),
    onSuccess: () => {
      setBody('')
      clearUploads()
      onCancelReply()
      void queryClient.invalidateQueries({
        queryKey: ['messages', conversationId],
      })
    },
    onError: () => toast.error('Failed to send message. Please try again.'),
  })

  const uploading = uploads.some((upload) => upload.status === 'uploading')
  const readyAttachmentIds = uploads
    .filter((upload) => upload.status === 'done' && upload.attachmentId)
    .map((upload) => upload.attachmentId as string)
  const canSend =
    !isPending && !uploading && (body.trim().length > 0 || readyAttachmentIds.length > 0)

  const submit = () => {
    if (!canSend) return
    mutate({ text: body, attachmentIds: readyAttachmentIds })
  }

  const startUpload = (file: File) => {
    const id = crypto.randomUUID()
    const isImage = file.type.startsWith('image/')

    setUploads((current) => [
      ...current,
      {
        id,
        name: file.name,
        isImage,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        progress: 0,
        status: 'uploading',
      },
    ])

    uploadAttachment(file, (percent) => {
      setUploads((current) =>
        current.map((upload) => (upload.id === id ? { ...upload, progress: percent } : upload)),
      )
    })
      .then((attachment) => {
        setUploads((current) =>
          current.map((upload) =>
            upload.id === id
              ? { ...upload, status: 'done', progress: 100, attachmentId: attachment.id }
              : upload,
          ),
        )
      })
      .catch(() => {
        setUploads((current) =>
          current.map((upload) => (upload.id === id ? { ...upload, status: 'error' } : upload)),
        )
        toast.error(`Couldn't upload ${file.name}.`)
      })
  }

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return
    const files = Array.from(fileList)

    let slots = MAX_ATTACHMENTS - uploads.length
    for (const file of files) {
      if (slots <= 0) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
        break
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name} isn't a supported file type.`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is larger than 15 MB.`)
        continue
      }
      startUpload(file)
      slots -= 1
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeUpload = (id: string) => {
    setUploads((current) => {
      const target = current.find((upload) => upload.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return current.filter((upload) => upload.id !== id)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)

    if (!typingThrottle.current) {
      void postTyping(conversationId)
      typingThrottle.current = setTimeout(() => {
        typingThrottle.current = null
      }, TYPING_THROTTLE_MS)
    }
  }

  return (
    <form
      className='composer-form'
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {replyingTo && (
        <div className='composer__reply-chip'>
          <span className='truncate'>
            Replying to <strong>{replyingTo.sender?.name ?? 'Unknown'}</strong>: {replyingTo.body}
          </span>
          <button type='button' onClick={onCancelReply} aria-label='Cancel reply'>
            &times;
          </button>
        </div>
      )}

      {uploads.length > 0 && (
        <div className='composer__uploads'>
          {uploads.map((upload) => (
            <div key={upload.id} className='upload-chip'>
              {upload.previewUrl ? (
                <img src={upload.previewUrl} alt={upload.name} />
              ) : (
                <span aria-hidden='true'>📄</span>
              )}
              <span className='truncate'>{upload.name}</span>
              {upload.status === 'uploading' && <span className='muted'>{upload.progress}%</span>}
              {upload.status === 'error' && (
                <span style={{ color: 'var(--c-danger)' }}>failed</span>
              )}
              <button
                type='button'
                onClick={() => removeUpload(upload.id)}
                aria-label={`Remove ${upload.name}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div className='composer'>
        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          hidden
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <button
          type='button'
          className='btn ghost icon'
          onClick={() => fileInputRef.current?.click()}
          aria-label='Attach files'
        >
          <span aria-hidden='true'>📎</span>
        </button>
        <label htmlFor='message-input' className='sr-only'>
          Message
        </label>
        <textarea
          id='message-input'
          placeholder='Type a message…'
          className='textarea composer__text'
          rows={1}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <button
          type='submit'
          className='btn primary icon'
          disabled={!canSend}
          aria-label={isPending ? 'Sending' : uploading ? 'Uploading' : 'Send message'}
        >
          <span aria-hidden='true'>{isPending || uploading ? '…' : '➤'}</span>
        </button>
      </div>
    </form>
  )
}

export default MessageForm
