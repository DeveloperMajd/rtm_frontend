import { describe, expect, it } from 'vitest'
import { resolveUnreadBoundary } from './unreadDivider'
import type { MessageType } from './baseTypes'

/** Ids stand in for UUIDv7s: what matters is that they sort chronologically,
 * which is what the anchor comparison relies on. */
const userMessage = (id: string, senderId: string): MessageType => ({
  id,
  conversation_id: 'c1',
  type: 'user',
  sender: { id: senderId, name: senderId },
  body: id,
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
})

const systemMessage = (id: string): MessageType => ({
  id,
  conversation_id: 'c1',
  type: 'system',
  event_type: 'member_added',
  sender: null,
  body: '',
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
})

describe('resolveUnreadBoundary', () => {
  it('shows no divider when nothing is unread', () => {
    const messages = [userMessage('id-01', 'other'), userMessage('id-02', 'other')]
    expect(resolveUnreadBoundary(messages, 'id-02', 0, 'me', false)).toEqual({
      boundaryId: null,
      needsMore: false,
    })
  })

  it('anchors the divider on the first message newer than the read pointer', () => {
    const messages = [
      userMessage('id-01', 'other'),
      userMessage('id-02', 'other'), // read up to here
      userMessage('id-03', 'other'), // first unread
      userMessage('id-04', 'other'),
    ]
    expect(resolveUnreadBoundary(messages, 'id-02', 2, 'me', false)).toEqual({
      boundaryId: 'id-03',
      needsMore: false,
    })
  })

  // The viewer's own replies and system lines sit among the unread ones but
  // are not themselves unread, so the divider must skip past them.
  it("skips the viewer's own messages when looking for the first unread one", () => {
    const messages = [
      userMessage('id-01', 'other'),
      userMessage('id-02', 'me'), // own reply, newer than the anchor
      userMessage('id-03', 'other'), // the real first unread
    ]
    expect(resolveUnreadBoundary(messages, 'id-01', 1, 'me', false).boundaryId).toBe('id-03')
  })

  it('skips system messages when looking for the first unread one', () => {
    const messages = [
      userMessage('id-01', 'other'),
      systemMessage('id-02'),
      userMessage('id-03', 'other'),
    ]
    expect(resolveUnreadBoundary(messages, 'id-01', 1, 'me', false).boundaryId).toBe('id-03')
  })

  // The reported case: messages sent while the recipient was away, more of
  // them than the first page holds. The loaded window starts *after* the read
  // pointer, so there may be older unread messages not loaded yet — page back
  // until the window covers the anchor rather than guessing.
  it('asks for more history while the loaded window does not reach back to the anchor', () => {
    const messages = [userMessage('id-11', 'other'), userMessage('id-12', 'other')]
    expect(resolveUnreadBoundary(messages, 'id-05', 8, 'me', true)).toEqual({
      boundaryId: undefined,
      needsMore: true,
    })
  })

  it('stops asking once the window reaches back past the anchor', () => {
    const messages = [
      userMessage('id-04', 'other'),
      userMessage('id-05', 'other'), // the anchor itself is loaded
      userMessage('id-06', 'other'),
    ]
    expect(resolveUnreadBoundary(messages, 'id-05', 1, 'me', true)).toEqual({
      boundaryId: 'id-06',
      needsMore: false,
    })
  })

  it('settles for the best answer it has once history is exhausted', () => {
    const messages = [userMessage('id-11', 'other'), userMessage('id-12', 'other')]
    expect(resolveUnreadBoundary(messages, 'id-05', 8, 'me', false)).toEqual({
      boundaryId: 'id-11',
      needsMore: false,
    })
  })

  it('asks for more when nothing has loaded yet but something is known to be unread', () => {
    expect(resolveUnreadBoundary([], 'id-05', 3, 'me', true)).toEqual({
      boundaryId: undefined,
      needsMore: true,
    })
  })

  it('shows no divider when nothing has loaded and there is no more history', () => {
    expect(resolveUnreadBoundary([], 'id-05', 3, 'me', false)).toEqual({
      boundaryId: null,
      needsMore: false,
    })
  })

  it('shows no divider when every loaded message is older than the anchor', () => {
    const messages = [userMessage('id-01', 'other'), userMessage('id-02', 'other')]
    expect(resolveUnreadBoundary(messages, 'id-09', 2, 'me', false)).toEqual({
      boundaryId: null,
      needsMore: false,
    })
  })

  // A conversation never read at all: the divider belongs above the very
  // first message, but paging an entire history back to draw it is not worth
  // the round trips, so it waits until everything happens to be loaded.
  it('draws the divider at the start when the conversation was never read and is fully loaded', () => {
    const messages = [
      userMessage('id-01', 'me'),
      userMessage('id-02', 'other'),
      userMessage('id-03', 'other'),
    ]
    expect(resolveUnreadBoundary(messages, null, 2, 'me', false)).toEqual({
      boundaryId: 'id-02',
      needsMore: false,
    })
  })

  it('does not page an entire unread history back just to draw a line above all of it', () => {
    const messages = [userMessage('id-50', 'other')]
    expect(resolveUnreadBoundary(messages, null, 200, 'me', true)).toEqual({
      boundaryId: null,
      needsMore: false,
    })
  })
})
