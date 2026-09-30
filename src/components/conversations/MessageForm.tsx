import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { isAxiosError } from 'axios'
import { sendMessage, updateMessage, uploadAttachment } from '../../services/api/messages'
import { postTyping } from '../../services/api/conversations'
import { appendMessageToCache, messagesKey, replaceMessageInCache } from '../../utils/messagePages'
import { loadDraft, saveDraft } from '../../utils/drafts'
import {
  ACCEPTED_SUMMARY,
  ACCEPTED_TYPES,
  IMAGE_TYPES,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
} from '../../utils/attachments'
import { isTouchScreen } from '../../utils/pointer'
import useAuth from '../../hooks/useAuth'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import BottomSheet, { SheetAction } from '../ui/BottomSheet'
import Icon from '../ui/Icon'
import ComposerTray, { type PendingUpload } from './ComposerTray'
import type { MessageType } from '../../utils/baseTypes'

/** What the room can ask of the composer — files dropped on the
 * conversation go through the same checks as ones picked with the button. */
export type MessageFormHandle = {
  addFiles: (files: File[]) => void
  /** Puts the caret in the message field. */
  focus: () => void
}

type MessageFormProps = {
  conversationId: string
  replyingTo: MessageType | null
  onCancelReply: () => void
  /** The viewer's own message being edited, or null when composing. */
  editing: MessageType | null
  /** Leave edit mode — after saving, or on cancel. */
  onFinishEdit: () => void
  /** A message has been sent (after it's in the cache). */
  onSent?: () => void
  ref?: Ref<MessageFormHandle>
}

const TYPING_THROTTLE_MS = 2000

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
  onSent,
  ref,
}: MessageFormProps) => {
  const { user } = useAuth()
  // Picks up whatever was left unsent here last time (see utils/drafts).
  const [body, setBody] = useState(() => (user ? loadDraft(user.id, conversationId) : ''))
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const queryClient = useQueryClient()
  const typingThrottle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // The attach sheet's three ways in (touch screens only — see openAttach).
  const photoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const [isAttachSheetOpen, setIsAttachSheetOpen] = useState(false)
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

  // The draft is what the viewer is composing — during an edit, the text set
  // aside for it, never the edited message. Sending empties it, which
  // forgets it.
  const userId = user?.id
  const draft = editingId === null ? body : setAsideDraft
  useEffect(() => {
    if (userId) saveDraft(userId, conversationId, draft)
  }, [userId, conversationId, draft])

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

  // Why the last send didn't go (Study-Failed-Offline). The text stays in
  // the composer either way; this says so and offers to try again.
  const [sendProblem, setSendProblem] = useState<'failed' | 'throttled' | null>(null)
  // No network: sending waits, the draft stays (States-Connection "Offline").
  const online = useOnlineStatus()

  const { mutate, isPending } = useMutation({
    mutationFn: ({ text, attachmentIds }: { text: string; attachmentIds: string[] }) =>
      sendMessage(conversationId, text, replyingTo?.id, attachmentIds),
    onMutate: () => setSendProblem(null),
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
        void queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) })
      }
      onSent?.()
    },
    // 429: the per-route throttle. Its Retry-After can't be read from here
    // (CORS doesn't expose it), so no countdown — just the reason.
    onError: (err) => setSendProblem(isAxiosError(err) && err.response?.status === 429 ? 'throttled' : 'failed'),
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
    online && !isPending && !uploading && (body.trim().length > 0 || readyAttachmentIds.length > 0)
  // The API requires a body on an edit, so an edit can't empty a message.
  const canSaveEdit = online && !isSavingEdit && body.trim().length > 0
  const atLimit = uploads.length >= MAX_ATTACHMENTS

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

  const updateUpload = (id: string, patch: Partial<PendingUpload>) => {
    setUploads((current) =>
      current.map((upload) => (upload.id === id ? { ...upload, ...patch } : upload)),
    )
  }

  const runUpload = (id: string, file: File) => {
    uploadAttachment(file, (percent) => updateUpload(id, { progress: percent }))
      .then((attachment) => {
        updateUpload(id, { status: 'done', progress: 100, attachmentId: attachment.id })
      })
      .catch(() => {
        updateUpload(id, { status: 'error' })
        toast.error(`Couldn't upload ${file.name}.`)
      })
  }

  const retryUpload = (id: string) => {
    const upload = uploads.find((u) => u.id === id)
    if (!upload) return
    updateUpload(id, { status: 'uploading', progress: 0 })
    runUpload(id, upload.file)
  }

  /**
   * The one way files enter the tray — the attach button, a paste, or a
   * drop on the conversation. The checks are the same ones the upload has
   * always had; only how a failure is shown differs. A file that's too big
   * stays in the tray marked "Over 15 MB" (the design's "the good file
   * stays" — sending goes ahead without it); a type the API won't take never
   * enters it, and a toast says so.
   */
  const addFiles = (files: File[]) => {
    const added: PendingUpload[] = []
    let slots = MAX_ATTACHMENTS - uploads.length

    for (const file of files) {
      if (slots <= 0) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
        break
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name} isn’t supported. Use JPG, PNG, GIF, WebP or PDF.`)
        continue
      }

      const isImage = file.type.startsWith('image/')
      const tooBig = file.size > MAX_FILE_BYTES
      added.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        isImage,
        previewUrl: isImage && !tooBig ? URL.createObjectURL(file) : undefined,
        progress: 0,
        status: tooBig ? 'rejected' : 'uploading',
        rejection: tooBig ? 'Over 15 MB' : undefined,
      })
      slots -= 1
    }

    if (added.length === 0) return
    setUploads((current) => [...current, ...added])
    for (const upload of added) {
      if (upload.status === 'uploading') runUpload(upload.id, upload.file)
    }
  }

  useImperativeHandle(ref, () => ({ addFiles, focus: () => textareaRef.current?.focus() }))

  const handleFilesSelected = (input: HTMLInputElement) => {
    if (input.files) addFiles(Array.from(input.files))
    input.value = ''
  }

  // With a mouse, the paperclip opens the file picker straight away. On a
  // touch screen it offers a choice first (Mobile-Attachments-Flow): the
  // photo library, the camera, or a document.
  const openAttach = () => {
    if (isTouchScreen()) setIsAttachSheetOpen(true)
    else fileInputRef.current?.click()
  }

  const pickFrom = (input: HTMLInputElement | null) => {
    setIsAttachSheetOpen(false)
    input?.click()
  }

  // A screenshot pasted into the composer joins the tray. Only when the
  // clipboard holds files and no text — pasting from a document can carry
  // both, and then the text is what's meant.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (editing) return
    const files = Array.from(e.clipboardData.files)
    if (files.length === 0 || e.clipboardData.getData('text/plain')) return
    e.preventDefault()
    addFiles(files)
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
    // Nothing left to have failed to send.
    if (!e.target.value.trim()) setSendProblem(null)

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
  const showTrayHint = !editing && uploads.length > 0

  return (
    <form
      className='composer-form'
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
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

        {/* Attachments can't be added to an edit (it only changes the
            text), so any in progress stay put, out of sight, until it's
            done. */}
        {!editing && uploads.length > 0 && (
          <ComposerTray uploads={uploads} onRemove={removeUpload} onRetry={retryUpload} />
        )}

        <div className='composer__row'>
          <input
            ref={fileInputRef}
            type='file'
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            hidden
            onChange={(e) => handleFilesSelected(e.target)}
          />
          <input
            ref={photoInputRef}
            type='file'
            multiple
            accept={IMAGE_TYPES.join(',')}
            hidden
            data-testid='attach-photos'
            onChange={(e) => handleFilesSelected(e.target)}
          />
          <input
            ref={cameraInputRef}
            type='file'
            accept={IMAGE_TYPES.join(',')}
            capture='environment'
            hidden
            data-testid='attach-camera'
            onChange={(e) => handleFilesSelected(e.target)}
          />
          <input
            ref={documentInputRef}
            type='file'
            multiple
            accept='application/pdf'
            hidden
            data-testid='attach-documents'
            onChange={(e) => handleFilesSelected(e.target)}
          />
          <button
            type='button'
            className='composer__icon-btn'
            onClick={openAttach}
            disabled={Boolean(editing) || atLimit || !online}
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
            onPaste={handlePaste}
            enterKeyHint={editing ? 'done' : 'send'}
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
      {sendProblem && !editing && (
        <p className='composer__note is-error' role='alert'>
          <Icon name='alertCircle' size={14} />
          <span>
            {sendProblem === 'throttled'
              ? 'Slow down a little — you’re sending faster than we allow. Your message is kept.'
              : 'Not sent. Your message is kept.'}
          </span>
          <button type='button' className='composer__note-action' onClick={submit} disabled={!canSend}>
            Retry
          </button>
        </p>
      )}
      {/* Not a live region: AppShell already says the app went offline. */}
      {!online && (
        <p className='composer__note'>
          <Icon name='wifiOff' size={14} />
          <span>Draft saved on this device · sending resumes when you’re back</span>
        </p>
      )}
      {sendProblem || !online ? null : showTrayHint ? (
        <p className='composer__hint is-split' aria-hidden='true'>
          <span>{ACCEPTED_SUMMARY}</span>
          {atLimit && <span>Limit reached</span>}
        </p>
      ) : (
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
      )}
      {/* Said out loud as well as shown: the attach button has just been
          disabled, and this is why. */}
      <p className='composer__limit' role='status'>
        {showTrayHint && atLimit && (
          <>
            <span className='composer__limit-count'>
              {MAX_ATTACHMENTS} / {MAX_ATTACHMENTS}
            </span>
            A message holds up to {MAX_ATTACHMENTS} files. Remove one to add another.
          </>
        )}
      </p>

      <BottomSheet
        open={isAttachSheetOpen}
        onClose={() => setIsAttachSheetOpen(false)}
        title='Attach'
        note={`Up to ${MAX_ATTACHMENTS} files per message · 15 MB each`}
      >
        <div className='sheet-actions'>
          <SheetAction
            icon='image'
            label='Photo library'
            hint='JPG, PNG, GIF or WebP'
            onSelect={() => pickFrom(photoInputRef.current)}
          />
          <SheetAction
            icon='camera'
            label='Take a photo'
            hint='Opens the camera'
            onSelect={() => pickFrom(cameraInputRef.current)}
          />
          <SheetAction
            icon='fileText'
            label='Choose a file'
            hint='PDF documents'
            onSelect={() => pickFrom(documentInputRef.current)}
          />
        </div>
      </BottomSheet>
    </form>
  )
}

export default MessageForm
