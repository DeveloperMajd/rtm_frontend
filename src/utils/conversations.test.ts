import { describe, expect, it } from 'vitest'
import { sortByRecency } from './conversations'
import type { ConversationType } from './baseTypes'

const conversation = (overrides: Partial<ConversationType>): ConversationType => ({
  id: overrides.id ?? 'c1',
  type: 'direct',
  created_by_user_id: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('sortByRecency', () => {
  it('orders by last_message_at, most recent first', () => {
    const older = conversation({ id: 'older', last_message_at: '2026-01-01T00:00:00Z' })
    const newer = conversation({ id: 'newer', last_message_at: '2026-01-03T00:00:00Z' })
    const middle = conversation({ id: 'middle', last_message_at: '2026-01-02T00:00:00Z' })

    expect(sortByRecency([older, newer, middle]).map((c) => c.id)).toEqual([
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

    expect(sortByRecency([withMessages, noMessages]).map((c) => c.id)).toEqual([
      'no-messages',
      'with-messages',
    ])
  })

  it('does not mutate the input array', () => {
    const list = [conversation({ id: 'a' }), conversation({ id: 'b' })]
    const original = [...list]
    sortByRecency(list)
    expect(list).toEqual(original)
  })
})
