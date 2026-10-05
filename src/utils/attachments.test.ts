import { describe, expect, it } from 'vitest'
import {
  attachmentDownloadUrl,
  fileKindLabel,
  formatBytes,
  signedUrlExpiresAt,
  splitFileName,
} from './attachments'

describe('formatBytes', () => {
  it.each([
    [392, '392 B'],
    [340 * 1024, '340 KB'],
    [2.4 * 1024 * 1024, '2.4 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})

describe('fileKindLabel', () => {
  it.each([
    ['application/pdf', 'notes.pdf', 'PDF'],
    ['image/jpeg', 'photo.jpg', 'JPG'],
    ['image/webp', 'photo.webp', 'WEBP'],
    ['application/octet-stream', 'archive.zip', 'ZIP'],
    ['application/octet-stream', 'README', 'File'],
  ])('labels %s (%s) as %s', (mime, name, expected) => {
    expect(fileKindLabel(mime, name)).toBe(expected)
  })
})

describe('splitFileName', () => {
  it('keeps the extension apart so a long name can shrink in the middle', () => {
    expect(splitFileName('quarterly-infrastructure-cost-review-final-v3.pdf')).toEqual({
      base: 'quarterly-infrastructure-cost-review-final-v3',
      ext: '.pdf',
    })
  })

  it.each(['README', '.env', 'trailing.'])('treats %s as having no extension', (name) => {
    expect(splitFileName(name)).toEqual({ base: name, ext: '' })
  })
})

describe('signedUrlExpiresAt', () => {
  it("reads Laravel's signed local-disk URLs (expires, in seconds)", () => {
    const url = 'http://localhost:8000/storage/attachments/a.pdf?expires=1790257360&signature=abc'
    expect(signedUrlExpiresAt(url)).toBe(1790257360 * 1000)
  })

  it('reads S3/R2 presigned URLs (X-Amz-Date + X-Amz-Expires)', () => {
    const url =
      'https://bucket.r2.cloudflarestorage.com/attachments/a.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260924T132800Z&X-Amz-Expires=1800&X-Amz-Signature=abc'
    expect(signedUrlExpiresAt(url)).toBe(Date.UTC(2026, 8, 24, 13, 28, 0) + 1800 * 1000)
  })

  it.each(['https://cdn.test/attachments/a.pdf', 'not a url', 'https://x.test/a?expires=soon'])(
    'returns null when %s says nothing usable',
    (url) => {
      expect(signedUrlExpiresAt(url)).toBeNull()
    },
  )
})

describe('attachmentDownloadUrl', () => {
  it("points at the API's auth-checked download route", () => {
    expect(attachmentDownloadUrl('att-1')).toMatch(/\/attachments\/att-1$/)
  })
})
