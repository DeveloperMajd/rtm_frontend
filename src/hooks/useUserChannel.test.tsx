import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import useUserChannel from './useUserChannel'
import { AuthContext, type AuthContextType } from './useAuth'
import { settingsKey, DEFAULT_SETTINGS } from './useSettings'
import { forgetTyping, useListTyping } from './useListTyping'
import { playMessageTone, showMessageNotification } from '../utils/alerts'
import type { ConversationType, MessageType } from '../utils/baseTypes'

const echo = vi.hoisted(() => {
  const handlers: Record<string, (payload: unknown) => void> = {}
  const channel = {
    listen: (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = handler
      return channel
    },
    stopListening: () => channel,
  }
  return { handlers, instance: { private: () => channel, leave: () => {} } }
})

vi.mock('./useEcho', () => ({ default: () => echo.instance }))
vi.mock('../utils/alerts', () => ({
  playMessageTone: vi.fn(),
  showMessageNotification: vi.fn(),
  unlockAudio: vi.fn(),
}))

const auth = {
  user: { id: 'me', name: 'Me', email: 'me@example.com' },
} as AuthContextType

const conversation = (id: string, extra: Partial<ConversationType> = {}) =>
  ({ id, type: 'direct', other_participant: { id: 'jo', name: 'Jo' }, ...extra }) as ConversationType

const message = (conversationId: string, extra: Partial<MessageType> = {}): MessageType => ({
  id: `m-${Math.random()}`,
  conversation_id: conversationId,
  type: 'user',
  sender: { id: 'jo', name: 'Jo' },
  body: 'hello there',
  reactions: [],
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  ...extra,
})

let client: QueryClient
let path = '/conversations/open'
let looking = true

const Where = () => <output aria-label='Address'>{useLocation().pathname}</output>

const render = () =>
  renderHook(() => useUserChannel(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path='*' element={<><Where />{children}</>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    ),
  })

const arrive = (m: MessageType) => act(() => echo.handlers.MessageSent?.(m))

beforeEach(() => {
  client = new QueryClient()
  client.setQueryData(['conversations'], {
    data: [conversation('open'), conversation('other'), conversation('quiet', { muted_at: '2026-10-01T09:00:00Z' }), conversation('team', { type: 'group', title: 'Team' })],
  })
  client.setQueryData(settingsKey, { ...DEFAULT_SETTINGS, message_sounds: true, desktop_notifications: true })
  path = '/conversations/open'
  looking = true
  vi.spyOn(document, 'hasFocus').mockImplementation(() => looking)
  vi.mocked(playMessageTone).mockClear()
  vi.mocked(showMessageNotification).mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useUserChannel — getting attention for a message', () => {
  it('plays the tone for a message in another chat, but shows no alert while RTM is in front', () => {
    render()
    arrive(message('other'))

    expect(playMessageTone).toHaveBeenCalledTimes(1)
    expect(showMessageNotification).not.toHaveBeenCalled()
  })

  it('stays quiet for the chat being looked at', () => {
    render()
    arrive(message('open'))

    expect(playMessageTone).not.toHaveBeenCalled()
  })

  it('shows a desktop alert when RTM is in the background — opening the chat from it', () => {
    looking = false
    render()
    arrive(message('team', { body: 'standup moved' }))

    expect(playMessageTone).toHaveBeenCalled()
    expect(showMessageNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Jo · Team', body: 'standup moved', conversationId: 'team' }),
    )

    act(() => vi.mocked(showMessageNotification).mock.calls[0][0].onOpen())
    expect(screen.getByRole('status', { name: 'Address' })).toHaveTextContent('/conversations/team')
  })

  it('never for the viewer’s own message, a group event, or a muted chat', () => {
    looking = false
    render()
    arrive(message('other', { sender: { id: 'me', name: 'Me' } }))
    arrive(message('other', { type: 'system', sender: null }))
    arrive(message('quiet'))

    expect(playMessageTone).not.toHaveBeenCalled()
    expect(showMessageNotification).not.toHaveBeenCalled()
  })

  it('does only what’s switched on', () => {
    looking = false
    client.setQueryData(settingsKey, { ...DEFAULT_SETTINGS, message_sounds: false, desktop_notifications: true })
    render()
    arrive(message('other'))

    expect(playMessageTone).not.toHaveBeenCalled()
    expect(showMessageNotification).toHaveBeenCalledTimes(1)
  })

  it('does nothing with both off — the default', () => {
    looking = false
    client.setQueryData(settingsKey, DEFAULT_SETTINGS)
    render()
    arrive(message('other'))

    expect(playMessageTone).not.toHaveBeenCalled()
    expect(showMessageNotification).not.toHaveBeenCalled()
  })
})

describe('useUserChannel — who’s typing, for the chat list', () => {
  const typingIn = (conversationId: string) => renderHook(() => useListTyping(conversationId)).result

  const ping = (conversationId: string, userId: string, name: string) =>
    act(() => echo.handlers.TypingIndicator?.({ conversation_id: conversationId, user_id: userId, name }))

  afterEach(() => {
    act(() => forgetTyping())
  })

  it('notes someone typing in any conversation, open or not', () => {
    render()
    const other = typingIn('other')

    ping('other', 'jo', 'Jo')

    expect(other.current).toEqual(['Jo'])
  })

  it('never shows the viewer as typing, from another tab of theirs', () => {
    render()
    const open = typingIn('open')

    ping('open', 'me', 'Me')

    expect(open.current).toEqual([])
  })

  it('stops showing someone typing once their message arrives', () => {
    render()
    const other = typingIn('other')
    ping('other', 'jo', 'Jo')

    arrive(message('other', { sender: { id: 'jo', name: 'Jo' } }))

    expect(other.current).toEqual([])
  })

  it('forgets who was typing when the channel closes', () => {
    const view = render()
    const other = typingIn('other')
    ping('other', 'jo', 'Jo')

    view.unmount()

    expect(other.current).toEqual([])
  })
})
