import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { applyReadPointer, readPointersKey, receiptFor, type Reader } from './readReceipts'
import type { ReadPointer } from '../services/api/conversations'

const reader = (id: string): Reader => ({ user_id: id, name: `Person ${id}` })
const pointer = (userId: string, messageId: string | null): ReadPointer => ({
  user_id: userId,
  last_read_message_id: messageId,
  last_read_at: messageId ? '2026-09-30T10:00:00Z' : null,
})

describe('receiptFor', () => {
  it('direct: Sent until the other person has read that far, then Seen', () => {
    const readers = [reader('jo')]

    expect(receiptFor('m5', readers, [pointer('jo', 'm4')], false)).toEqual({ kind: 'sent' })
    expect(receiptFor('m5', readers, [pointer('jo', null)], false)).toEqual({ kind: 'sent' })
    expect(receiptFor('m5', readers, [], false)).toEqual({ kind: 'sent' })
    expect(receiptFor('m5', readers, [pointer('jo', 'm5')], false)).toEqual({ kind: 'seen' })
  })

  // Pointers only move forward past everything before them.
  it('counts reading a later message as having read this one', () => {
    expect(receiptFor('m5', [reader('jo')], [pointer('jo', 'm9')], false)).toEqual({ kind: 'seen' })
  })

  it('group: who has read it and who hasn’t yet, in the order they’re listed', () => {
    const readers = [reader('a'), reader('b'), reader('c')]
    const pointers = [pointer('a', 'm6'), pointer('b', 'm2'), pointer('c', 'm5')]

    expect(receiptFor('m5', readers, pointers, true)).toEqual({
      kind: 'seen-by',
      seen: [reader('a'), reader('c')],
      notYet: [reader('b')],
    })
  })

  it('group: still just Sent while nobody has read it', () => {
    expect(receiptFor('m5', [reader('a'), reader('b')], [pointer('a', 'm1')], true)).toEqual({ kind: 'sent' })
  })

  it('ignores pointers of people who aren’t readers any more', () => {
    expect(receiptFor('m5', [reader('a')], [pointer('left', 'm9')], false)).toEqual({ kind: 'sent' })
  })
})

describe('applyReadPointer', () => {
  const seeded = (pointers: ReadPointer[]) => {
    const client = new QueryClient()
    client.setQueryData(readPointersKey('c1'), pointers)
    return client
  }
  const cached = (client: QueryClient) => client.getQueryData<ReadPointer[]>(readPointersKey('c1'))

  it('moves someone’s pointer forward', () => {
    const client = seeded([pointer('a', 'm2'), pointer('b', 'm1')])

    applyReadPointer(client, 'c1', pointer('a', 'm4'))

    expect(cached(client)).toEqual([pointer('a', 'm4'), pointer('b', 'm1')])
  })

  // Queued broadcasts can arrive out of order.
  it('never moves one back', () => {
    const client = seeded([pointer('a', 'm4')])
    const before = cached(client)

    applyReadPointer(client, 'c1', pointer('a', 'm2'))

    expect(cached(client)).toBe(before)
  })

  it('adds someone it hadn’t heard of (a member added since it loaded)', () => {
    const client = seeded([pointer('a', 'm4')])

    applyReadPointer(client, 'c1', pointer('new', 'm4'))

    expect(cached(client)).toEqual([pointer('a', 'm4'), pointer('new', 'm4')])
  })

  it('leaves nothing cached as nothing', () => {
    const client = new QueryClient()

    applyReadPointer(client, 'c1', pointer('a', 'm4'))

    expect(cached(client)).toBeUndefined()
  })
})
