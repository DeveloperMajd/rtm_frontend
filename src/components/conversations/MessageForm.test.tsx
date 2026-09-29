import { createRef, useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MessageForm, { type MessageFormHandle } from './MessageForm'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import { sendMessage, updateMessage, uploadAttachment } from '../../services/api/messages'
import type { MessageType } from '../../utils/baseTypes'

vi.mock('../../services/api/messages', () => ({
  sendMessage: vi.fn(),
  updateMessage: vi.fn(),
  uploadAttachment: vi.fn(),
}))
vi.mock('../../services/api/conversations', () => ({
  postTyping: vi.fn().mockResolvedValue(undefined),
}))

const authValue: AuthContextType = {
  user: { id: 'me', name: 'Me', email: 'me@example.com' },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshUser: vi.fn(),
  sessionExpired: false,
  signedOutByChoice: false,
  endExpiredSession: vi.fn(),
}

const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  )
}

const message = (overrides: Partial<MessageType> = {}): MessageType => ({
  id: 'm1',
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'me', name: 'Me' },
  body: 'Deploying the fix now, ETA five minutes.',
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  ...overrides,
})

type FormProps = {
  replyingTo?: MessageType | null
  editing?: MessageType | null
  onCancelReply?: () => void
  onFinishEdit?: () => void
}

const renderForm = ({ replyingTo = null, editing = null, onCancelReply = vi.fn(), onFinishEdit = vi.fn() }: FormProps = {}) => {
  const ui = (props: FormProps) => (
    <Providers>
      <MessageForm
        conversationId='c1'
        replyingTo={props.replyingTo ?? null}
        onCancelReply={props.onCancelReply ?? onCancelReply}
        editing={props.editing ?? null}
        onFinishEdit={props.onFinishEdit ?? onFinishEdit}
      />
    </Providers>
  )
  const utils = render(ui({ replyingTo, editing }))
  return {
    ...utils,
    rerenderWith: (props: FormProps) => utils.rerender(ui(props)),
  }
}

const textbox = () => screen.getByRole('textbox', { name: 'Message' })

beforeEach(() => {
  vi.mocked(sendMessage).mockReset()
  vi.mocked(updateMessage).mockReset()
})

describe('MessageForm — reply', () => {
  it('shows who is being replied to above the composer, and Esc cancels it', async () => {
    const user = userEvent.setup()
    const onCancelReply = vi.fn()
    renderForm({
      replyingTo: message({ sender: { id: 'other', name: 'Jordan' }, body: 'Are we on a 30 s TTL?' }),
      onCancelReply,
    })

    expect(screen.getByText('Jordan')).toBeInTheDocument()
    expect(screen.getByText('Are we on a 30 s TTL?')).toBeInTheDocument()
    expect(textbox()).toHaveFocus()
    expect(textbox()).toHaveAccessibleDescription(/Replying to Jordan/)

    await user.keyboard('{Escape}')

    expect(onCancelReply).toHaveBeenCalledTimes(1)
  })

  it('names an attachment-only message by what it carried', () => {
    renderForm({
      replyingTo: message({
        sender: { id: 'other', name: 'Jordan' },
        body: '',
        attachments: [
          {
            id: 'a1',
            message_id: 'm1',
            original_name: 'load-test-notes.pdf',
            mime_type: 'application/pdf',
            size_bytes: 1000,
            is_image: false,
            url: 'https://example.com/a1',
            created_at: '2026-01-01T10:00:00Z',
          },
        ],
      }),
    })

    expect(screen.getByText('load-test-notes.pdf')).toBeInTheDocument()
  })
})

describe('MessageForm — edit', () => {
  it('puts the message into the composer with an Editing banner and a Save button', () => {
    renderForm({ editing: message() })

    expect(screen.getByText('Editing message')).toBeInTheDocument()
    expect(textbox()).toHaveValue('Deploying the fix now, ETA five minutes.')
    expect(textbox()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Save edit' })).toBeEnabled()
    // An edit only changes the text.
    expect(screen.getByRole('button', { name: 'Attach files' })).toBeDisabled()
  })

  it('sets the draft aside while editing and hands it back afterwards', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderForm()

    await user.type(textbox(), 'half-written thought')
    rerenderWith({ editing: message() })
    expect(textbox()).toHaveValue('Deploying the fix now, ETA five minutes.')

    rerenderWith({ editing: null })
    expect(textbox()).toHaveValue('half-written thought')
  })

  it('cancels on Esc', async () => {
    const user = userEvent.setup()
    const onFinishEdit = vi.fn()
    renderForm({ editing: message(), onFinishEdit })

    await user.keyboard('{Escape}')

    expect(onFinishEdit).toHaveBeenCalledTimes(1)
    expect(updateMessage).not.toHaveBeenCalled()
  })

  it('leaves edit mode without saving when nothing changed, so the message is not marked edited', async () => {
    const user = userEvent.setup()
    const onFinishEdit = vi.fn()
    renderForm({ editing: message(), onFinishEdit })

    await user.keyboard('{Enter}')

    expect(onFinishEdit).toHaveBeenCalledTimes(1)
    expect(updateMessage).not.toHaveBeenCalled()
  })

  it('saves a changed message with the same PATCH as before, then leaves edit mode', async () => {
    const user = userEvent.setup()
    const onFinishEdit = vi.fn()
    vi.mocked(updateMessage).mockResolvedValue(message({ body: 'ETA ten minutes.', edited_at: '2026-01-01T10:01:00Z' }))
    renderForm({ editing: message(), onFinishEdit })

    await user.clear(textbox())
    await user.type(textbox(), 'ETA ten minutes.{Enter}')

    expect(updateMessage).toHaveBeenCalledWith('m1', 'ETA ten minutes.')
    await waitFor(() => expect(onFinishEdit).toHaveBeenCalledTimes(1))
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('cannot save an edit that empties the message', async () => {
    const user = userEvent.setup()
    renderForm({ editing: message() })

    await user.clear(textbox())

    expect(screen.getByRole('button', { name: 'Save edit' })).toBeDisabled()
  })

  it('stays in edit mode with the text intact when saving fails', async () => {
    const user = userEvent.setup()
    const onFinishEdit = vi.fn()
    vi.mocked(updateMessage).mockRejectedValue(new Error('422'))
    renderForm({ editing: message(), onFinishEdit })

    await user.type(textbox(), ' Update:{Enter}')

    await waitFor(() => expect(updateMessage).toHaveBeenCalled())
    expect(onFinishEdit).not.toHaveBeenCalled()
    expect(textbox()).toHaveValue('Deploying the fix now, ETA five minutes. Update:')
  })
})

describe('MessageForm — attachments', () => {
  const file = (name: string, type: string, size = 1000) => {
    const f = new File(['x'], name, { type })
    Object.defineProperty(f, 'size', { value: size })
    return f
  }
  const fileInput = (container: HTMLElement) => container.querySelector('input[type=file]') as HTMLInputElement
  const attachment = (id: string) => ({
    id,
    message_id: null,
    original_name: `${id}.png`,
    mime_type: 'image/png',
    size_bytes: 1000,
    is_image: true,
    url: `https://cdn.test/${id}`,
    created_at: '2026-01-01T10:00:00Z',
  })

  beforeEach(() => {
    vi.mocked(uploadAttachment).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  it('refuses a type the API will not take, before uploading anything', () => {
    const { container } = renderForm()

    fireEvent.change(fileInput(container), { target: { files: [file('recording.mov', 'video/quicktime')] } })

    expect(uploadAttachment).not.toHaveBeenCalled()
    expect(screen.queryByRole('list', { name: 'Attachments' })).not.toBeInTheDocument()
  })

  it('keeps an oversized file in the tray, marked, without uploading it — and sends the rest without it', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadAttachment).mockResolvedValue(attachment('good'))
    vi.mocked(sendMessage).mockResolvedValue({} as MessageType)
    const { container } = renderForm()

    fireEvent.change(fileInput(container), {
      target: { files: [file('big-export.pdf', 'application/pdf', 16 * 1024 * 1024), file('photo.png', 'image/png')] },
    })

    expect(screen.getByText('Over 15 MB')).toBeInTheDocument()
    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadAttachment).mock.calls[0][0].name).toBe('photo.png')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(sendMessage).toHaveBeenCalledWith('c1', '', undefined, ['good'])
  })

  it('offers a retry on a failed upload, which re-sends the same file', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadAttachment).mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce(attachment('ok'))
    const { container } = renderForm()
    const photo = file('photo.png', 'image/png')

    fireEvent.change(fileInput(container), { target: { files: [photo] } })
    await user.click(await screen.findByRole('button', { name: 'Upload of photo.png failed. Retry' }))

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledTimes(2))
    expect(vi.mocked(uploadAttachment).mock.calls[1][0]).toBe(photo)
  })

  it('stops at 10 files: the attach button turns off and says why', () => {
    vi.mocked(uploadAttachment).mockReturnValue(new Promise(() => {}))
    const { container } = renderForm()

    fireEvent.change(fileInput(container), {
      target: { files: Array.from({ length: 12 }, (_, i) => file(`p${i}.png`, 'image/png')) },
    })

    expect(uploadAttachment).toHaveBeenCalledTimes(10)
    expect(screen.getByRole('button', { name: 'Attach files' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('A message holds up to 10 files.')
  })

  it('takes a pasted screenshot into the tray', () => {
    vi.mocked(uploadAttachment).mockReturnValue(new Promise(() => {}))
    renderForm()

    fireEvent.paste(textbox(), {
      clipboardData: { files: [file('pasted.png', 'image/png')], getData: () => '' },
    })

    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('list', { name: 'Attachments' })).toBeInTheDocument()
  })

  it('leaves a paste that carries text to the textarea', () => {
    renderForm()

    fireEvent.paste(textbox(), {
      clipboardData: { files: [file('rendering.png', 'image/png')], getData: () => 'some copied text' },
    })

    expect(uploadAttachment).not.toHaveBeenCalled()
  })

  it('accepts files handed over by the room (a drop on the conversation)', () => {
    vi.mocked(uploadAttachment).mockReturnValue(new Promise(() => {}))
    const handle = createRef<MessageFormHandle>()
    render(
      <Providers>
        <MessageForm
          ref={handle}
          conversationId='c1'
          replyingTo={null}
          onCancelReply={vi.fn()}
          editing={null}
          onFinishEdit={vi.fn()}
        />
      </Providers>,
    )

    act(() => handle.current?.addFiles([file('dropped.png', 'image/png')]))

    expect(uploadAttachment).toHaveBeenCalledTimes(1)
  })
})

describe('MessageForm — drafts', () => {
  it('picks up what was left unsent in this conversation', () => {
    localStorage.setItem('rtm.draft.me.c1', 'where was I')
    renderForm()

    expect(textbox()).toHaveValue('where was I')
  })

  it('keeps what’s typed on this device, and forgets it once sent', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(message({ id: 'm2', body: 'hello' }))
    renderForm()

    await user.type(textbox(), 'hello')
    expect(localStorage.getItem('rtm.draft.me.c1')).toBe('hello')

    await user.keyboard('{Enter}')
    await waitFor(() => expect(textbox()).toHaveValue(''))
    expect(localStorage.getItem('rtm.draft.me.c1')).toBeNull()
  })

  it('never saves an edit as the draft — the text set aside stays the draft', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderForm()

    await user.type(textbox(), 'half-written thought')
    rerenderWith({ editing: message() })
    await user.type(textbox(), ' (edited)')

    expect(localStorage.getItem('rtm.draft.me.c1')).toBe('half-written thought')
  })
})

describe('MessageForm — attaching on a touch screen', () => {
  const setTouchScreen = (touch: boolean) => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: touch && query.includes('pointer: coarse'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
  }
  const opened: HTMLInputElement[] = []

  beforeEach(() => {
    opened.length = 0
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      opened.push(this)
    })
    vi.mocked(uploadAttachment).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error jsdom has no matchMedia of its own to put back.
    delete window.matchMedia
  })

  it('offers the photo library, the camera or a document before opening a picker', async () => {
    const user = userEvent.setup()
    setTouchScreen(true)
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Attach files' }))

    const sheet = screen.getByRole('dialog', { name: 'Attach' })
    expect(within(sheet).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Photo libraryJPG, PNG, GIF or WebP',
      'Take a photoOpens the camera',
      'Choose a filePDF documents',
    ])
    expect(sheet).toHaveTextContent('Up to 10 files per message · 15 MB each')
    expect(opened).toHaveLength(0)
  })

  it('opens the camera for a photo, and closes the sheet', async () => {
    const user = userEvent.setup()
    setTouchScreen(true)
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Attach files' }))
    await user.click(screen.getByRole('button', { name: /Take a photo/ }))

    expect(opened).toHaveLength(1)
    expect(opened[0]).toHaveAttribute('capture', 'environment')
    expect(opened[0].accept).toBe('image/jpeg,image/png,image/gif,image/webp')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('limits each way in to what it says, and whatever is picked joins the tray', async () => {
    const user = userEvent.setup()
    setTouchScreen(true)
    vi.mocked(uploadAttachment).mockReturnValue(new Promise(() => {}))
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Attach files' }))
    await user.click(screen.getByRole('button', { name: /Choose a file/ }))
    const documents = screen.getByTestId('attach-documents') as HTMLInputElement
    expect(opened).toEqual([documents])
    expect(documents.accept).toBe('application/pdf')
    expect(documents.multiple).toBe(true)

    fireEvent.change(documents, { target: { files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] } })

    expect(uploadAttachment).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('notes.pdf')
  })

  it('opens the file picker straight away with a mouse', async () => {
    const user = userEvent.setup()
    setTouchScreen(false)
    const { container } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Attach files' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opened).toEqual([container.querySelector('input[type=file]')])
  })

  it('asks the phone keyboard for a Send key', () => {
    renderForm()

    expect(textbox()).toHaveAttribute('enterkeyhint', 'send')
  })
})
