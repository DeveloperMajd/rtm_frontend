import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import useUserChannel, { LAST_SEEN_SETTLE_MS } from './useUserChannel'
import { AuthContext, type AuthContextType } from './useAuth'
import { settingsKey, DEFAULT_SETTINGS } from './useSettings'
import { forgetTyping, useListTyping } from './useListTyping'
import { playMessageTone, showMessageNotification } from '../utils/alerts'
import { listenToRoom } from '../utils/roomEvents'
import type { ContactType, ConversationType, MessageType } from '../utils/baseTypes'

const echo = vi.hoisted(() => {
  const handlers: Record<string, (payload: unknown) => void> = {}
  // What runs each time the channel's subscription succeeds.
  const subscription: { succeeded: () => void } = { succeeded: () => {} }
  const channel = {
    listen: (event: string, handler: (payload: unknown) => void) => {
      handlers[event] = handler
      return channel
    },
    stopListening: () => channel,
    subscribed: (callback: () => void) => {
      subscription.succeeded = callback
      return channel
    },
  }
  // The socket's state, and whoever is told when it changes.
  const connection: { status: string; onChange: (status: string) => void } = { status: 'connecting', onChange: () => {} }
  const connector = {
    connectionStatus: () => connection.status,
    onConnectionChange: (listener: (status: string) => void) => {
      connection.onChange = listener
      return () => {}
    },
  }
  return { handlers, subscription, connection, instance: { private: () => channel, leave: () => {}, connector } }
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

describe('useUserChannel — who’s typing, for the chat list and the open room', () => {
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

// A conversation has no channel of its own: its events come on the viewer's,
// and each is handed to that conversation's room.
describe('useUserChannel — a conversation’s events, for its room', () => {
  it('hands each one to the room of the conversation it’s about', () => {
    const room = {
      MessageSent: vi.fn(),
      MessageUpdated: vi.fn(),
      MessageReactionUpdated: vi.fn(),
      ConversationRead: vi.fn(),
    }
    const stop = listenToRoom('team', room)
    render()
    const sent = message('team')

    act(() => {
      echo.handlers.MessageSent?.(sent)
      echo.handlers.MessageUpdated?.({ ...sent, body: 'edited' })
      echo.handlers.MessageReactionUpdated?.({ ...sent, reactions: [{ emoji: '👍' }] })
      echo.handlers.ConversationRead?.({ conversation_id: 'team', user_id: 'jo', last_read_message_id: sent.id, last_read_at: null })
    })
    stop()

    expect(room.MessageSent).toHaveBeenCalledExactlyOnceWith(sent)
    expect(room.MessageUpdated).toHaveBeenCalledExactlyOnceWith({ ...sent, body: 'edited' })
    expect(room.MessageReactionUpdated).toHaveBeenCalledExactlyOnceWith({ ...sent, reactions: [{ emoji: '👍' }] })
    // The pointer as the room keeps it: the room knows which conversation it is.
    expect(room.ConversationRead).toHaveBeenCalledExactlyOnceWith({ user_id: 'jo', last_read_message_id: sent.id, last_read_at: null })
  })

  it('tells another conversation’s room nothing', () => {
    const open = { MessageSent: vi.fn(), ConversationRead: vi.fn() }
    const stop = listenToRoom('open', open)
    render()

    act(() => {
      echo.handlers.MessageSent?.(message('other'))
      echo.handlers.ConversationRead?.({ conversation_id: 'other', user_id: 'jo', last_read_message_id: 'm1', last_read_at: null })
    })
    stop()

    expect(open.MessageSent).not.toHaveBeenCalled()
    expect(open.ConversationRead).not.toHaveBeenCalled()
  })

})

// Only from the channel's subscription on does the stream carry anything:
// each time it subscribes, every open room is told, so it can catch up.
describe('useUserChannel — the stream starting, and starting again', () => {
  it('tells every open room each time the channel subscribes, and that it resumed after the first', () => {
    const open = vi.fn()
    const other = vi.fn()
    const stopOpen = listenToRoom('open', { Subscribed: open })
    const stopOther = listenToRoom('other', { Subscribed: other })
    render()

    act(() => echo.subscription.succeeded())
    act(() => echo.subscription.succeeded())
    stopOpen()
    stopOther()

    expect(open.mock.calls).toEqual([[{ resumed: false }], [{ resumed: true }]])
    expect(other.mock.calls).toEqual([[{ resumed: false }], [{ resumed: true }]])
  })
})

// A message in a chat that isn't open is put on its row, rather than asking
// for the whole list again: that was one request from every member every
// time anyone wrote.
describe('useUserChannel — the chat list, kept current', () => {
  const row = (id: string) => client.getQueryData<{ data: ConversationType[] }>(['conversations'])!.data.find((c) => c.id === id)

  it('puts a message on its chat’s row, without fetching the list again', () => {
    render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    arrive(message('other', { body: 'see you at 5', created_at: '2026-10-01T11:00:00Z' }))

    expect(invalidate).not.toHaveBeenCalled()
    expect(row('other')).toMatchObject({
      unread_count: 1,
      last_message_at: '2026-10-01T11:00:00Z',
      latest_message: { body: 'see you at 5', sender_name: 'Jo' },
    })
  })

  it('fetches the list again for a group event, which can change what a patch can’t', () => {
    render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    arrive(message('team', { type: 'system', sender: null, body: '', event_type: 'group_renamed' }))

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations'] })
  })

  it('fetches the list again for a conversation it doesn’t have yet', () => {
    render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    arrive(message('brand-new'))

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations'] })
  })
})

describe('useUserChannel — presence, pushed', () => {
  const people = () => ({
    direct: conversation('open', { other_participant: { id: 'jo', name: 'Jo', is_online: false, presence_status: 'offline' as const } }),
    group: conversation('team', {
      type: 'group',
      title: 'Team',
      other_participant: null,
      participants: [
        { user_id: 'jo', name: 'Jo', role: 'participant', is_online: false, presence_status: 'offline' as const },
        { user_id: 'sam', name: 'Sam', role: 'participant', is_online: true, presence_status: 'online' as const },
      ],
    }),
    elsewhere: conversation('other', { other_participant: { id: 'sam', name: 'Sam', is_online: true, presence_status: 'online' as const } }),
  })

  const conversations = () => client.getQueryData<{ data: ConversationType[] }>(['conversations'])!.data
  const contacts = () => client.getQueryData<ContactType[]>(['contacts'])!
  const push = (change: { user_id: string; presence_status: 'online' | 'away' | 'offline'; is_online: boolean }) =>
    act(() => echo.handlers.PresenceChanged?.(change))

  beforeEach(() => {
    const { direct, group, elsewhere } = people()
    client.setQueryData(['conversations'], { data: [direct, group, elsewhere] })
    client.setQueryData(['contacts'], [
      { id: 'jo', name: 'Jo', is_online: false, presence_status: 'offline' },
      { id: 'sam', name: 'Sam', is_online: true, presence_status: 'online' },
    ])
    echo.connection.status = 'connecting'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a change at once wherever the person is, and leaves everyone else as they were', () => {
    render()
    const [, , samsChat] = conversations()
    const sam = contacts()[1]

    push({ user_id: 'jo', presence_status: 'away', is_online: true })

    const [direct, group, elsewhere] = conversations()
    expect(direct.other_participant).toMatchObject({ id: 'jo', presence_status: 'away', is_online: true })
    expect(group.participants?.[0]).toMatchObject({ user_id: 'jo', presence_status: 'away', is_online: true })
    expect(group.participants?.[1]).toMatchObject({ user_id: 'sam', presence_status: 'online' })
    expect(contacts()[0]).toMatchObject({ id: 'jo', presence_status: 'away', is_online: true })
    expect(elsewhere).toBe(samsChat)
    expect(contacts()[1]).toBe(sam)
  })

  it('asks for the lists again once someone has gone offline, for when they were last seen', () => {
    vi.useFakeTimers()
    render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    push({ user_id: 'jo', presence_status: 'online', is_online: true })
    push({ user_id: 'jo', presence_status: 'offline', is_online: false })
    expect(invalidate).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(LAST_SEEN_SETTLE_MS))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['contacts'] })
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('asks once about everyone who went offline in the meantime', () => {
    vi.useFakeTimers()
    render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    push({ user_id: 'jo', presence_status: 'offline', is_online: false })
    act(() => vi.advanceTimersByTime(LAST_SEEN_SETTLE_MS / 2))
    push({ user_id: 'sam', presence_status: 'offline', is_online: false })
    act(() => vi.advanceTimersByTime(LAST_SEEN_SETTLE_MS))

    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('asks in time even while people keep going offline', () => {
    vi.useFakeTimers()
    render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    push({ user_id: 'jo', presence_status: 'offline', is_online: false })
    act(() => vi.advanceTimersByTime(LAST_SEEN_SETTLE_MS - 1_000))
    push({ user_id: 'sam', presence_status: 'offline', is_online: false })
    act(() => vi.advanceTimersByTime(1_000))

    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('doesn’t ask at all about someone back within moments, as after a reload', () => {
    vi.useFakeTimers()
    render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    push({ user_id: 'jo', presence_status: 'offline', is_online: false })
    push({ user_id: 'jo', presence_status: 'online', is_online: true })
    act(() => vi.advanceTimersByTime(LAST_SEEN_SETTLE_MS))

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('doesn’t ask once the channel has closed', () => {
    vi.useFakeTimers()
    const view = render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    push({ user_id: 'jo', presence_status: 'offline', is_online: false })
    view.unmount()
    act(() => vi.advanceTimersByTime(LAST_SEEN_SETTLE_MS))

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('asks for the lists again once a dropped connection is back, not after the first connect', () => {
    render()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    // The page's first connect goes through connecting too.
    act(() => echo.connection.onChange('connecting'))
    act(() => echo.connection.onChange('connected'))
    expect(invalidate).not.toHaveBeenCalled()

    act(() => echo.connection.onChange('connecting'))
    act(() => echo.connection.onChange('connecting'))
    act(() => echo.connection.onChange('connected'))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['contacts'] })
    expect(invalidate).toHaveBeenCalledTimes(2)
  })
})
