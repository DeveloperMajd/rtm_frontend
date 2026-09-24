import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { mdiClose, mdiFileDocumentOutline } from '@mdi/js'
import { sendMessage, updateMessage, uploadAttachment } from '../../services/api/messages'
import { postTyping } from '../../services/api/conversations'
import { appendMessageToCache, replaceMessageInCache } from '../../utils/messagePages'
import useAuth from '../../hooks/useAuth'
import Icon from '../ui/Icon'
import type { MessageType } from '../../utils/baseTypes'

type MessageFormProps = {
  conversationId: string
  replyingTo: MessageType | null
  onCancelReply: () => void
  /** The viewer's own message being edited, or null when composing. */
  editing: MessageType | null
  /** Leave edit mode — after saving, or on cancel. */
  onFinishEdit: () => void
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

/** One line describing a message for a banner or quote: its text, or what
 * it carried when it had none. */
function describeMessage(message: MessageType): string {
  if (message.body) return message.body
  const first = message.attachments?.[0]
  if (first) return first.is_image ? 'Photo' : first.original_name
  return 'Attachment'
}

const MessageForm = ({
  conversationId,
  replyingTo,
  onCancelReply,
  editing,
  onFinishEdit,
}: MessageFormProps) => {
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const queryClient = useQueryClient()
  const typingThrottle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const uploadsRef = useRef<PendingUpload[]>([])
  const bannerId = useId()

  // Editing borrows the composer, so whatever the viewer had been typing is
  // set aside when an edit starts and handed back when it ends (saved or
  // cancelled) — not overwritten. Adjusted during render, React's pattern
  // for state that follows a prop.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [setAsideDraft, setSetAsideDraft] = useState('')
  const nextEditingId = editing?.id ?? null
  if (nextEditingId !== editingId) {
    if (editingId === null) setSetAsideDraft(body)
    setBody(editing ? editing.body : setAsideDraft)
    if (!editing) setSetAsideDraft('')
    setEditingId(nextEditingId)
  }

  // Starting a reply or an edit puts the caret at the end of the text, ready
  // to type — from the toolbar, the More menu, or its R shortcut alike.
  const replyingToId = replyingTo?.id
  useEffect(() => {
    if (!editingId && !replyingToId) return
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [editingId, replyingToId])

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
    onSuccess: (created) => {
      setBody('')
      clearUploads()
      onCancelReply()

      // Put the message the server just confirmed straight into the cache.
      // This used to invalidate the query instead, which on an infinite
      // query refetches *every* page that has been loaded — five sequential
      // round trips after a little scrolling back, growing with every page
      // the viewer pages in, before their own message appeared. Each of
      // those refetches also re-pulled overlapping pages (see
      // flattenMessagePages). The Echo broadcast for this same message
      // arrives later and de-duplicates against it.
      if (!appendMessageToCache(queryClient, conversationId, created)) {
        // Nothing cached to patch (the conversation hasn't loaded here yet).
        void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      }
    },
    onError: () => toast.error('Failed to send message. Please try again.'),
  })

  // Same PATCH the in-bubble editor used. The response is the edited
  // message, patched in straight away rather than waiting for the
  // MessageUpdated broadcast to come back round.
  const { mutate: saveEdit, isPending: isSavingEdit } = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updateMessage(id, text),
    onSuccess: (updated) => {
      replaceMessageInCache(queryClient, conversationId, updated)
      onFinishEdit()
    },
    // Stays in edit mode with the text intact, so nothing typed is lost.
    onError: () => toast.error('Couldn’t save your edit. Please try again.'),
  })

  const uploading = uploads.some((upload) => upload.status === 'uploading')
  const readyAttachmentIds = uploads
    .filter((upload) => upload.status === 'done' && upload.attachmentId)
    .map((upload) => upload.attachmentId as string)
  const canSend =
    !isPending && !uploading && (body.trim().length > 0 || readyAttachmentIds.length > 0)
  // The API requires a body on an edit, so an edit can't empty a message.
  const canSaveEdit = !isSavingEdit && body.trim().length > 0

  const submit = () => {
    if (editing) {
      if (!canSaveEdit) return
      // Nothing changed: leave edit mode without marking the message edited.
      if (body === editing.body) {
        onFinishEdit()
        return
      }
      saveEdit({ id: editing.id, text: body })
      return
    }

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
      return
    }

    // Esc backs out of an edit or a reply (the banners say so). Not while
    // an IME is composing, where Esc belongs to the IME.
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
      if (editing) {
        e.preventDefault()
        onFinishEdit()
      } else if (replyingTo) {
        e.preventDefault()
        onCancelReply()
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)

    // Rewording an existing message isn't "typing" a new one.
    if (!editing && !typingThrottle.current) {
      void postTyping(conversationId)
      typingThrottle.current = setTimeout(() => {
        typingThrottle.current = null
      }, TYPING_THROTTLE_MS)
    }
  }

  const replyThumbnail = replyingTo?.attachments?.find((a) => a.is_image)
  const replyAuthor =
    replyingTo?.sender?.id === user?.id ? 'yourself' : (replyingTo?.sender?.name ?? 'Unknown')

  let submitLabel = 'Send message'
  if (editing) submitLabel = isSavingEdit ? 'Saving edit' : 'Save edit'
  else if (isPending) submitLabel = 'Sending'
  else if (uploading) submitLabel = 'Uploading'
  const isBusy = editing ? isSavingEdit : isPending || uploading

  return (
    <form
      className='composer-form'
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {/* Attachments can't be added to an edit (it only changes the text),
          so any in progress stay put, out of the way, until it's done. */}
      {!editing && uploads.length > 0 && (
        <div className='composer__uploads'>
          {uploads.map((upload) => (
            <div key={upload.id} className='upload-chip'>
              {upload.previewUrl ? (
                <img src={upload.previewUrl} alt={upload.name} />
              ) : (
                <Icon path={mdiFileDocumentOutline} />
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
                <Icon path={mdiClose} size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`composer${editing ? ' is-editing' : ''}`}>
        {editing ? (
          <div id={bannerId} className='composer__banner is-edit'>
            <Icon name='pencil' size={16} className='composer__banner-icon' />
            <div className='composer__banner-text'>
              <span className='composer__banner-title'>Editing message</span>
              <span className='composer__banner-quote'>{describeMessage(editing)}</span>
            </div>
            <span className='composer__banner-hint' aria-hidden='true'>
              <kbd>Esc</kbd> cancel
            </span>
            <button
              type='button'
              className='composer__banner-close'
              onClick={onFinishEdit}
              aria-label='Cancel editing'
            >
              <Icon name='x' size={14} />
            </button>
          </div>
        ) : (
          replyingTo && (
            <div id={bannerId} className='composer__banner is-reply'>
              <Icon name='reply' size={16} className='composer__banner-icon' />
              {replyThumbnail && (
                <img src={replyThumbnail.url} alt='' className='composer__banner-thumb' />
              )}
              <div className='composer__banner-text'>
                <span className='composer__banner-title'>
                  Replying to <strong>{replyAuthor}</strong>
                </span>
                <span className='composer__banner-quote'>{describeMessage(replyingTo)}</span>
              </div>
              <button
                type='button'
                className='composer__banner-close'
                onClick={onCancelReply}
                aria-label='Cancel reply'
              >
                <Icon name='x' size={14} />
              </button>
            </div>
          )
        )}

        <div className='composer__row'>
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
            className='composer__icon-btn'
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(editing)}
            aria-label='Attach files'
          >
            <Icon name='clip' />
          </button>
          <label htmlFor='message-input' className='sr-only'>
            Message
          </label>
          <textarea
            ref={textareaRef}
            id='message-input'
            placeholder='Type a message…'
            className='composer__text'
            rows={1}
            value={body}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            aria-describedby={editing || replyingTo ? bannerId : undefined}
          />
          <button
            type='submit'
            className='btn primary icon composer__send'
            disabled={editing ? !canSaveEdit : !canSend}
            aria-label={submitLabel}
          >
            {isBusy ? (
              <span aria-hidden='true'>…</span>
            ) : (
              <Icon name={editing ? 'check' : 'send'} />
            )}
          </button>
        </div>
      </div>
      <p className='composer__hint' aria-hidden='true'>
        {editing ? (
          <>
            <kbd>↵</kbd> save · <kbd>⇧↵</kbd> new line · <kbd>esc</kbd> cancel
          </>
        ) : (
          <>
            <kbd>↵</kbd> send · <kbd>⇧↵</kbd> new line
            {replyingTo && (
              <>
                {' '}
                · <kbd>esc</kbd> cancel reply
              </>
            )}
          </>
        )}
      </p>
    </form>
  )
}

export default MessageForm
