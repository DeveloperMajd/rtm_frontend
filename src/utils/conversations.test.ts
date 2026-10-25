import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { applyMessageToConversationList, sortConversations, unreadTotal } from './conversations'
import type { ConversationType, MessageType } from './baseTypes'

const conversation = (overrides: Partial<ConversationType>): ConversationType => ({
  id: overrides.id ?? 'c1',
  type: 'direct',
  created_by_user_id: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('sortConversations', () => {
  it('orders by last_message_at, most recent first', () => {
    const older = conversation({ id: 'older', last_message_at: '2026-01-01T00:00:00Z' })
    const newer = conversation({ id: 'newer', last_message_at: '2026-01-03T00:00:00Z' })
    const middle = conversation({ id: 'middle', last_message_at: '2026-01-02T00:00:00Z' })

    expect(sortConversations([older, newer, middle]).map((c) => c.id)).toEqual([
      'newer',
      'middle',
      'older',
    ])
  })

  it('falls back to updated_at when a conversation has no messages yet', () => {
    const noMessages = conversation({
      id: 'no-messages',
      last_message_at: undefined,
      updated_at: '2026-01-05T00:00:00Z',
    })
    const withMessages = conversation({ id: 'with-messages', last_message_at: '2026-01-02T00:00:00Z' })

    expect(sortConversations([withMessages, noMessages]).map((c) => c.id)).toEqual([
      'no-messages',
      'with-messages',
    ])
  })

  it('puts pinned conversations first, each part by recency', () => {
    const list = [
      conversation({ id: 'recent', last_message_at: '2026-01-09T00:00:00Z' }),
      conversation({ id: 'pinned-old', last_message_at: '2026-01-01T00:00:00Z', pinned_at: '2026-01-05T00:00:00Z' }),
      conversation({ id: 'older', last_message_at: '2026-01-02T00:00:00Z' }),
      conversation({ id: 'pinned-new', last_message_at: '2026-01-04T00:00:00Z', pinned_at: '2026-01-03T00:00:00Z' }),
    ]

    expect(sortConversations(list).map((c) => c.id)).toEqual(['pinned-new', 'pinned-old', 'recent', 'older'])
  })

  it('does not mutate the input array', () => {
    const list = [conversation({ id: 'a' }), conversation({ id: 'b' })]
    const original = [...list]
    sortConversations(list)
    expect(list).toEqual(original)
  })
})

describe('unreadTotal', () => {
  const list = [
    conversation({ id: 'a', unread_count: 2 }),
    conversation({ id: 'b', unread_count: 3 }),
    conversation({ id: 'c' }),
    conversation({ id: 'left', unread_count: 9, viewer_left_at: '2026-01-02T00:00:00Z' }),
  ]

  it('adds up the unread messages, leaving out groups the viewer has left', () => {
    expect(unreadTotal(list)).toBe(5)
  })

  it('can leave out the conversation on screen', () => {
    expect(unreadTotal(list, 'b')).toBe(2)
  })

  // Muting is how someone says they don't want to hear about it; archiving
  // tidies it away. Each still shows its own count on its row.
  it('leaves out muted and archived conversations', () => {
    expect(
      unreadTotal([
        ...list,
        conversation({ id: 'muted', unread_count: 4, muted_at: '2026-01-02T00:00:00Z' }),
        conversation({ id: 'archived', unread_count: 6, archived_at: '2026-01-02T00:00:00Z' }),
      ]),
    ).toBe(5)
  })
})

describe('applyMessageToConversationList', () => {
  const message = (overrides: Partial<MessageType> = {}): MessageType => ({
    id: 'm9',
    conversation_id: 'c1',
    type: 'user',
    sender: { id: 'jo', name: 'Jo' },
    body: 'on my way',
    reactions: [],
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
    ...overrides,
  })
  const listWith = (row: Partial<ConversationType>) => {
    const client = new QueryClient()
    client.setQueryData(['conversations'], { data: [conversation({ id: 'c1', unread_count: 2, ...row }), conversation({ id: 'c2' })] })
    return client
  }
  const rowOf = (client: QueryClient, id = 'c1') =>
    client.getQueryData<{ data: ConversationType[] }>(['conversations'])!.data.find((c) => c.id === id)!

  it('puts the message on its row, one more unread when someone else sent it and nobody’s reading', () => {
    const client = listWith({})

    expect(applyMessageToConversationList(client, message(), 'me', { viewing: false })).toBe(true)

    expect(rowOf(client)).toMatchObject({
      unread_count: 3,
      last_message_at: '2026-02-01T10:00:00Z',
      latest_message: { type: 'user', body: 'on my way', sender_name: 'Jo' },
    })
    expect(rowOf(client, 'c2').latest_message).toBeUndefined()
  })

  it('counts nothing for the viewer’s own message, a group event, or one they’re looking at', () => {
    for (const [arrived, viewing] of [
      [message({ sender: { id: 'me', name: 'Me' } }), false],
      [message({ type: 'system', sender: null, body: '', event_type: 'member_added' }), false],
      [message(), true],
    ] as const) {
      const client = listWith({})
      applyMessageToConversationList(client, arrived, 'me', { viewing })
      expect(rowOf(client).unread_count).toBe(2)
    }
  })

  it('brings an archived chat back for someone else’s message, unless it’s muted', () => {
    const archived = listWith({ archived_at: '2026-01-05T00:00:00Z' })
    applyMessageToConversationList(archived, message(), 'me', { viewing: false })
    expect(rowOf(archived).archived_at).toBeNull()

    const muted = listWith({ archived_at: '2026-01-05T00:00:00Z', muted_at: '2026-01-04T00:00:00Z' })
    applyMessageToConversationList(muted, message(), 'me', { viewing: false })
    expect(rowOf(muted).archived_at).toBe('2026-01-05T00:00:00Z')

    const own = listWith({ archived_at: '2026-01-05T00:00:00Z' })
    applyMessageToConversationList(own, message({ sender: { id: 'me', name: 'Me' } }), 'me', { viewing: false })
    expect(rowOf(own).archived_at).toBe('2026-01-05T00:00:00Z')
  })

  it('says so when the list doesn’t have the conversation, or there’s no list yet', () => {
    const client = listWith({})
    const before = client.getQueryData(['conversations'])

    expect(applyMessageToConversationList(client, message({ conversation_id: 'new' }), 'me', { viewing: false })).toBe(false)
    expect(client.getQueryData(['conversations'])).toBe(before)
    expect(applyMessageToConversationList(new QueryClient(), message(), 'me', { viewing: false })).toBe(false)
  })
})
