import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axios'
import { heartbeat } from './presence'

vi.mock('./axios', () => ({ default: { post: vi.fn() } }))

const post = vi.mocked(api.post)

beforeEach(() => {
  post.mockReset()
  post.mockResolvedValue({ data: null })
})

describe('heartbeat', () => {
  it('says whether the app is in use', async () => {
    await heartbeat('away')
    expect(post).toHaveBeenLastCalledWith('/presence/heartbeat', { state: 'away' })

    await heartbeat('active')
    expect(post).toHaveBeenLastCalledWith('/presence/heartbeat', { state: 'active' })
  })

  it('is in use unless told otherwise', async () => {
    await heartbeat()
    expect(post).toHaveBeenLastCalledWith('/presence/heartbeat', { state: 'active' })
  })
})
