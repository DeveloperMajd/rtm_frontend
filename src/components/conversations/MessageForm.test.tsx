import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MessageForm from './MessageForm'
import { AuthContext, type AuthContextType } from '../../hooks/useAuth'
import { sendMessage, updateMessage } from '../../services/api/messages'
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
