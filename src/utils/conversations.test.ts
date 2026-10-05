import { describe, expect, it } from 'vitest'
import { sortConversations, unreadTotal } from './conversations'
import type { ConversationType } from './baseTypes'

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
