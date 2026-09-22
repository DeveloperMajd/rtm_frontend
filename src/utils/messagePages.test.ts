import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { appendMessageToCache, flattenMessagePages, type MessagesPage } from './messagePages'
import type { MessageType } from './baseTypes'

/** Ids are UUIDv7 in the real app — monotonic and lexicographically ordered
 * by time. These keep that property while staying readable. */
const msg = (id: string, body = id): MessageType => ({
  id,
  conversation_id: 'c1',
  type: 'user',
  sender: { id: 'other', name: 'Jordan' },
  body,
  reactions: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
})

const page = (data: MessageType[], hasMore = false): MessagesPage => ({
  data,
  meta: { has_more: hasMore, next_before_id: hasMore ? (data[0]?.id ?? null) : null },
})

describe('flattenMessagePages', () => {
  it('flattens newest-page-first into a single oldest-to-newest list', () => {
    const pages = [
      page([msg('id-05'), msg('id-06')]), // page 1 = newest
      page([msg('id-03'), msg('id-04')]), // page 2 = older
    ]
    expect(flattenMessagePages(pages).map((m) => m.id)).toEqual([
      'id-03',
      'id-04',
      'id-05',
      'id-06',
    ])
  })

  // The bug that prompted this function, kept as a guard now that the API
  // pages by cursor. Under offset pagination a list growing underneath the
  // client shifted every page boundary, so `?page=2` handed back rows page 1
  // already held — which rendered as React's "Encountered two children with
  // the same key" and, per React's own warning, children that can be
  // duplicated *or omitted*. A live append racing a fetch can still deliver
  // the same message twice, so overlapping input must stay survivable.
  it('drops rows delivered twice on overlapping pages', () => {
    const pages = [
      page([msg('id-03'), msg('id-04'), msg('id-05'), msg('id-06')]),
      page([msg('id-01'), msg('id-02'), msg('id-03'), msg('id-04')]),
    ]

    const flat = flattenMessagePages(pages)

    expect(flat.map((m) => m.id)).toEqual(['id-01', 'id-02', 'id-03', 'id-04', 'id-05', 'id-06'])
    expect(new Set(flat.map((m) => m.id)).size).toBe(flat.length)
  })

  it('keeps the newest page copy of a duplicated message (live edits land there)', () => {
    const pages = [
      page([msg('id-02', 'edited body')]),
      page([msg('id-01'), msg('id-02', 'stale body')]),
    ]
    expect(flattenMessagePages(pages).map((m) => m.body)).toEqual(['id-01', 'edited body'])
  })

  it('sorts by id so a message is placed chronologically whichever page it came on', () => {
    // id-04 turns up on the older page but still belongs last by time.
    const pages = [page([msg('id-02')]), page([msg('id-01'), msg('id-04')])]
    expect(flattenMessagePages(pages).map((m) => m.id)).toEqual(['id-01', 'id-02', 'id-04'])
  })

  it('handles an empty conversation', () => {
    expect(flattenMessagePages([page([])])).toEqual([])
    expect(flattenMessagePages([])).toEqual([])
  })
})

describe('appendMessageToCache', () => {
  const key = ['messages', 'c1']

  const seed = (client: QueryClient, pages: MessagesPage[]) =>
    client.setQueryData(key, { pages, pageParams: pages.map((_, i) => i + 1) })

  it('appends to the newest page and reports that it applied', () => {
    const client = new QueryClient()
    seed(client, [page([msg('id-01')])])

    expect(appendMessageToCache(client, 'c1', msg('id-02'))).toBe(true)

    const data = client.getQueryData<{ pages: MessagesPage[] }>(key)
    expect(data?.pages[0].data.map((m) => m.id)).toEqual(['id-01', 'id-02'])
  })

  it('is a no-op when the message is already on the newest page', () => {
    const client = new QueryClient()
    seed(client, [page([msg('id-01')])])

    appendMessageToCache(client, 'c1', msg('id-01'))

    const data = client.getQueryData<{ pages: MessagesPage[] }>(key)
    expect(data?.pages[0].data).toHaveLength(1)
  })

  // The composer patches in the send response and the Echo broadcast for the
  // same message follows; if that message is sitting on an older page by
  // then, only checking the newest page would re-add it.
  it('is a no-op when the message is only on an older page', () => {
    const client = new QueryClient()
    seed(client, [page([msg('id-03')]), page([msg('id-01'), msg('id-02')])])

    appendMessageToCache(client, 'c1', msg('id-02'))

    const data = client.getQueryData<{ pages: MessagesPage[] }>(key)
    expect(data?.pages[0].data.map((m) => m.id)).toEqual(['id-03'])
  })

  it('reports that it did not apply when nothing is cached, so the caller can fetch', () => {
    const client = new QueryClient()
    expect(appendMessageToCache(client, 'c1', msg('id-01'))).toBe(false)
  })
})
