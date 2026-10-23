import { describe, expect, it, vi } from 'vitest'
import { listenToRoom, tellEveryRoom, tellRoom } from './roomEvents'
import type { MessageType } from './baseTypes'

const message = (conversationId: string): MessageType => ({
  id: 'm1',
  conversation_id: conversationId,
  type: 'user',
  sender: { id: 'jo', name: 'Jo' },
  body: 'hello',
  reactions: [],
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
})

describe('roomEvents', () => {
  it('tells the open room its own events, and only those it listens for', () => {
    const sent = vi.fn()
    const typing = vi.fn()
    const stop = listenToRoom('c1', { MessageSent: sent, TypingIndicator: typing })

    tellRoom('c1', 'MessageSent', message('c1'))
    tellRoom('c1', 'MessageUpdated', message('c1'))

    expect(sent).toHaveBeenCalledExactlyOnceWith(message('c1'))
    expect(typing).not.toHaveBeenCalled()
    stop()
  })

  it('keeps another conversation’s events from it', () => {
    const sent = vi.fn()
    const stop = listenToRoom('c1', { MessageSent: sent })

    tellRoom('c2', 'MessageSent', message('c2'))

    expect(sent).not.toHaveBeenCalled()
    stop()
  })

  it('tells everyone listening to the room, and stops telling each as it stops', () => {
    const room = vi.fn()
    const typing = vi.fn()
    const stopRoom = listenToRoom('c1', { TypingIndicator: room })
    const stopTyping = listenToRoom('c1', { TypingIndicator: typing })

    tellRoom('c1', 'TypingIndicator', { user_id: 'jo', name: 'Jo' })
    stopRoom()
    tellRoom('c1', 'TypingIndicator', { user_id: 'jo', name: 'Jo' })

    expect(room).toHaveBeenCalledTimes(1)
    expect(typing).toHaveBeenCalledTimes(2)
    stopTyping()
  })

  it('tells every open room what isn’t about one conversation', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = listenToRoom('c1', { Subscribed: first })
    const stopSecond = listenToRoom('c2', { Subscribed: second })

    tellEveryRoom('Subscribed', { resumed: true })
    stopFirst()
    tellEveryRoom('Subscribed', { resumed: false })

    expect(first.mock.calls).toEqual([[{ resumed: true }]])
    expect(second.mock.calls).toEqual([[{ resumed: true }], [{ resumed: false }]])
    stopSecond()
  })
})
