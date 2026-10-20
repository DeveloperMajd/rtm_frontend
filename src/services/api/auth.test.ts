import { beforeEach, expect, it, vi } from 'vitest'
import api from './axios'
import { sendVerificationLink, verifyEmail } from './auth'

vi.mock('./axios', () => ({ default: { post: vi.fn().mockResolvedValue({ data: {} }) } }))

beforeEach(() => {
  vi.clearAllMocks()
})

// The API checks the signature against the path and the query exactly as
// it was signed: `expires`, then `signature`.
it('posts a confirmation link back to the path it was signed for', async () => {
  await verifyEmail({ id: 'u1', hash: 'abc', expires: '123', signature: 'sig' })

  const [url, body, config] = vi.mocked(api.post).mock.calls[0]
  expect(url).toBe('/auth/email/verify/u1/abc')
  expect(body).toBeNull()
  expect(config?.params).toEqual({ expires: '123', signature: 'sig' })
  expect(Object.keys(config?.params ?? {})).toEqual(['expires', 'signature'])
})

it('asks for another confirmation link', async () => {
  await sendVerificationLink()

  expect(api.post).toHaveBeenCalledWith('/auth/email/verification-notification')
})
