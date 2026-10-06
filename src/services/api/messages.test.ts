import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axios'
import { getMessageInfo, getMessagesPage } from './messages'
import type { MessageType } from '../../utils/baseTypes'

vi.mock('./axios', () => ({ default: { get: vi.fn() } }))

const get = vi.mocked(api.get)

const msg = (id: string) => ({ id }) as MessageType

beforeEach(() => {
  get.mockReset()
})

describe('getMessagesPage', () => {
  it('reads the newest page with no cursor', async () => {
    get.mockResolvedValue({ data: { data: [msg('m9')], meta: { has_more: true, next_before_id: 'm9' } } })

    const page = await getMessagesPage('c1', { kind: 'latest' })

    expect(get).toHaveBeenCalledWith('/conversations/c1/messages', { params: undefined })
    expect(page.meta).toEqual({ has_more: true, next_before_id: 'm9' })
  })

  it('reads older history from a cursor', async () => {
    get.mockResolvedValue({ data: { data: [msg('m1')], meta: { has_more: false, next_before_id: null } } })

    await getMessagesPage('c1', { kind: 'older', before: 'm5' })

    expect(get).toHaveBeenCalledWith('/conversations/c1/messages', { params: { before_id: 'm5' } })
  })

  it('opens a window around a message, with a cursor each way', async () => {
    get.mockResolvedValue({
      data: {
        data: [msg('m4'), msg('m5'), msg('m6')],
        meta: { target_id: 'm5', has_more_before: true, has_more_after: true, next_before_id: 'm4', next_after_id: 'm6' },
      },
    })

    const page = await getMessagesPage('c1', { kind: 'around', id: 'm5' })

    expect(get).toHaveBeenCalledWith('/conversations/c1/messages/m5/context')
    expect(page.meta).toEqual({ has_more: true, next_before_id: 'm4', next_after_id: 'm6' })
  })

  it('reads newer history forwards, keeping an older cursor for when the window is fetched again', async () => {
    get.mockResolvedValue({
      data: { data: [msg('m7'), msg('m8')], meta: { has_more: true, next_after_id: 'm8' } },
    })

    const page = await getMessagesPage('c1', { kind: 'newer', after: 'm6' })

    expect(get).toHaveBeenCalledWith('/conversations/c1/messages', { params: { after_id: 'm6' } })
    expect(page.meta).toEqual({ has_more: true, next_before_id: 'm7', next_after_id: 'm8' })
  })

  it('marks the page that reaches the newest message as the end', async () => {
    get.mockResolvedValue({ data: { data: [msg('m7')], meta: { has_more: false, next_after_id: null } } })

    const page = await getMessagesPage('c1', { kind: 'newer', after: 'm6' })

    expect(page.meta.next_after_id).toBeNull()
  })
})

describe('getMessageInfo', () => {
  it('reads what the server knows about one message', async () => {
    const info = {
      id: 'm1',
      sender: { id: 'u1', name: 'Jordan' },
      sent_at: '2026-01-01T10:00:00Z',
      edited_at: null,
      deleted_at: null,
      read_by: [{ user_id: 'u2', name: 'Sam' }],
      not_read: [],
      receipts_hidden: false,
    }
    get.mockResolvedValue({ data: { data: info } })

    expect(await getMessageInfo('m1')).toEqual(info)
    expect(get).toHaveBeenCalledWith('/messages/m1/info')
  })
})
