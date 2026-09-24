import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  appendMessageToCache,
  flattenMessagePages,
  markMessageDeletedInCache,
  replaceMessageInCache,
  type MessagesPage,
} from './messagePages'
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

describe('replaceMessageInCache / markMessageDeletedInCache', () => {
  const key = ['messages', 'c1']

  const seed = (client: QueryClient, pages: MessagesPage[]) =>
    client.setQueryData(key, { pages, pageParams: pages.map((_, i) => i + 1) })

  const all = (client: QueryClient) =>
    client.getQueryData<{ pages: MessagesPage[] }>(key)?.pages.flatMap((p) => p.data) ?? []

  const replyTo = (id: string, quoted: MessageType): MessageType => ({
    ...msg(id),
    reply_to: { id: quoted.id, body: quoted.body, sender: quoted.sender },
  })

  it('replaces an edited message on whichever page holds it', () => {
    const client = new QueryClient()
    seed(client, [page([msg('id-03')]), page([msg('id-01'), msg('id-02', 'before')])])

    replaceMessageInCache(client, 'c1', { ...msg('id-02', 'after'), edited_at: '2026-01-01T10:05:00Z' })

    const edited = all(client).find((m) => m.id === 'id-02')
    expect(edited?.body).toBe('after')
    expect(edited?.edited_at).toBe('2026-01-01T10:05:00Z')
  })

  it("refreshes every reply's quote of an edited message, across pages", () => {
    const client = new QueryClient()
    const original = msg('id-01', 'before')
    seed(client, [page([replyTo('id-03', original)]), page([original])])

    replaceMessageInCache(client, 'c1', msg('id-01', 'after'))

    expect(all(client).find((m) => m.id === 'id-03')?.reply_to?.body).toBe('after')
  })

  it('shows a confirmed delete straight away — text cleared, attachments withheld, quotes redacted', () => {
    const client = new QueryClient()
    const original = {
      ...msg('id-01', 'secret'),
      attachments: [
        {
          id: 'a1',
          message_id: 'id-01',
          original_name: 'notes.pdf',
          mime_type: 'application/pdf',
          size_bytes: 10,
          is_image: false,
          url: 'https://example.com/a1',
          created_at: '2026-01-01T10:00:00Z',
        },
      ],
    }
    seed(client, [page([original, replyTo('id-02', original)])])

    markMessageDeletedInCache(client, 'c1', 'id-01')

    const [deleted, reply] = all(client)
    expect(deleted.deleted_at).toEqual(expect.any(String))
    expect(deleted.body).toBe('')
    expect(deleted.attachments).toEqual([])
    expect(reply.reply_to?.body).toBe('')
    expect(reply.reply_to?.deleted_at).toBe(deleted.deleted_at)
  })

  // The MessageUpdated broadcast can beat the DELETE response back; the
  // server's own timestamp should survive.
  it("leaves a copy that's already marked deleted alone", () => {
    const client = new QueryClient()
    seed(client, [page([{ ...msg('id-01', ''), deleted_at: '2026-01-01T10:05:00Z' }])])

    markMessageDeletedInCache(client, 'c1', 'id-01')

    expect(all(client)[0].deleted_at).toBe('2026-01-01T10:05:00Z')
  })

  it('does nothing when the message is not cached', () => {
    const client = new QueryClient()
    seed(client, [page([msg('id-01')])])
    const before = client.getQueryData(key)

    replaceMessageInCache(client, 'c1', msg('id-99'))

    expect(client.getQueryData(key)).toBe(before)
  })
})
