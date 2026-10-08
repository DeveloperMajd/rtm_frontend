import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { applyReadPointer, covers, readPointersKey, receiptFor, type Reader } from './readReceipts'
import type { ReadPointer, ReadStretch } from '../services/api/conversations'

const reader = (id: string): Reader => ({ user_id: id, name: `Person ${id}` })
const pointer = (userId: string, messageId: string | null): ReadPointer => ({
  user_id: userId,
  last_read_message_id: messageId,
  last_read_at: messageId ? '2026-09-30T10:00:00Z' : null,
})
const shared = (userId: string, messageId: string | null, stretches: ReadStretch[]): ReadPointer => ({
  ...pointer(userId, messageId),
  stretches,
})

// Sam read m1–m3 with read receipts on, m4–m6 with them off, then switched
// back on and read m7–m8.
const sam = shared('sam', 'm8', [
  [null, 'm3'],
  ['m6', null],
])
const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9']

describe('covers', () => {
  it('counts only what was read while sharing, however far the pointer has gone since', () => {
    expect(ids.filter((id) => covers(sam, id))).toEqual(['m1', 'm2', 'm3', 'm7', 'm8'])
  })

  it('stops where the last stretch closed, for someone who doesn’t share now', () => {
    const off = shared('sam', 'm3', [[null, 'm3']])

    expect(ids.filter((id) => covers(off, id))).toEqual(['m1', 'm2', 'm3'])
  })

  it('counts nothing for someone who has shared nothing', () => {
    expect(covers(shared('sam', 'm5', []), 'm1')).toBe(false)
  })

  it('needs the viewer’s side too: nothing read while the viewer had theirs off counts', () => {
    // Sam shares everything; the viewer turned theirs off when Sam was at m3
    // and back on when he was at m6.
    const seenByViewer: ReadPointer = { ...shared('sam', 'm8', [[null, null]]), viewer_stretches: [[null, 'm3'], ['m6', null]] }

    expect(ids.filter((id) => covers(seenByViewer, id))).toEqual(['m1', 'm2', 'm3', 'm7', 'm8'])
  })

  it('counts only what was read while both sides had read receipts on', () => {
    const both: ReadPointer = { ...sam, viewer_stretches: [[null, 'm2'], ['m7', null]] }

    expect(ids.filter((id) => covers(both, id))).toEqual(['m1', 'm2', 'm8'])
  })

  it('takes a pointer from a server without stretches as all shared, as it was', () => {
    expect(covers(pointer('sam', 'm5'), 'm5')).toBe(true)
    expect(covers(pointer('sam', 'm5'), 'm6')).toBe(false)
    expect(covers(pointer('sam', null), 'm1')).toBe(false)
  })
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

  it('doesn’t count a read made with read receipts off, even after reading on with them on', () => {
    expect(receiptFor('m5', [reader('sam')], [sam], false)).toEqual({ kind: 'sent' })
    expect(receiptFor('m7', [reader('sam')], [sam], false)).toEqual({ kind: 'seen' })
    expect(receiptFor('m5', [reader('a'), reader('sam')], [pointer('a', 'm6'), sam], true)).toEqual({
      kind: 'seen-by',
      seen: [reader('a')],
      notYet: [reader('sam')],
    })
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

  it('takes the stretches a live read carries along with its pointer', () => {
    const client = seeded([shared('sam', 'm3', [[null, null]])])

    applyReadPointer(client, 'c1', sam)

    expect(cached(client)).toEqual([sam])
  })

  // A live read goes to everyone alike, so it can't carry anyone's own side.
  it('keeps the viewer’s own side of someone when their live read comes in', () => {
    const client = seeded([{ ...shared('sam', 'm3', [[null, null]]), viewer_stretches: [[null, 'm2']] }])

    applyReadPointer(client, 'c1', sam)

    expect(cached(client)).toEqual([{ ...sam, viewer_stretches: [[null, 'm2']] }])
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
