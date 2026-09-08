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
      className='message-form flex flex-col gap-1 my-4'
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {replyingTo && (
        <div className='reply-chip flex items-center justify-between border-l-2 border-blue-400 bg-blue-50 rounded px-2 py-1 text-xs text-gray-600'>
          <span className='truncate'>
            Replying to <strong>{replyingTo.sender.name}</strong>: {replyingTo.body}
          </span>
          <button
            type='button'
            onClick={onCancelReply}
            className='text-gray-400 hover:text-gray-600 ml-2'
          >
            &times;
          </button>
        </div>
      )}

      {uploads.length > 0 && (
        <div className='attachment-previews flex flex-wrap gap-2 mb-1'>
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className='attachment-preview relative flex items-center gap-2 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs'
            >
              {upload.previewUrl ? (
                <img
                  src={upload.previewUrl}
                  alt={upload.name}
                  className='h-8 w-8 rounded object-cover'
                />
              ) : (
                <span aria-hidden>📄</span>
              )}
              <span className='max-w-30 truncate text-gray-600'>{upload.name}</span>
              {upload.status === 'uploading' && (
                <span className='text-gray-400'>{upload.progress}%</span>
              )}
              {upload.status === 'error' && <span className='text-red-500'>failed</span>}
              <button
                type='button'
                onClick={() => removeUpload(upload.id)}
                className='text-gray-400 hover:text-gray-600'
                aria-label={`Remove ${upload.name}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div className='flex justify-between items-center gap-2'>
        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          className='hidden'
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='attach-button text-xl text-gray-500 hover:text-gray-700'
          aria-label='Attach files'
        >
          📎
        </button>
        <textarea
          id='message-input'
          placeholder='Type your message...'
          className='message-input w-100'
          rows={1}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <button
          type='submit'
          className='send-button'
          disabled={!canSend}
        >
          {isPending ? 'Sending...' : uploading ? 'Uploading...' : 'Send'}
        </button>
      </div>
    </form>
  )
}

export default MessageForm
