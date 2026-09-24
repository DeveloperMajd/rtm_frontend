/**
 * What the composer accepts. The same limits the API enforces
 * (StoreAttachmentRequest / StoreMessageRequest): checking them here too
 * only saves a doomed upload.
 */
export const MAX_ATTACHMENTS = 10
export const MAX_FILE_BYTES = 15 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
export const ACCEPTED_SUMMARY = 'JPG · PNG · GIF · WebP · PDF — up to 15 MB each'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** "PDF", "PNG", … — the short type label on a file card. */
export function fileKindLabel(mimeType: string, name: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('image/')) {
    const subtype = mimeType.slice('image/'.length)
    return subtype === 'jpeg' ? 'JPG' : subtype.toUpperCase()
  }
  const ext = splitFileName(name).ext
  return ext ? ext.slice(1).toUpperCase() : 'File'
}

/**
 * Splits "quarterly-report-final.pdf" into its base and ".pdf", so a long
 * name can be truncated in the middle — the base shrinks, the extension
 * always stays readable.
 */
export function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot) }
}

/**
 * When a signed attachment URL stops working, in ms since the epoch — or
 * null when the URL doesn't say. Understands the two kinds this app hands
 * out: Laravel's signed local-disk URLs (`expires`, in seconds) and S3/R2
 * presigned URLs (`X-Amz-Date` + `X-Amz-Expires`).
 */
export function signedUrlExpiresAt(url: string): number | null {
  let params: URLSearchParams
  try {
    params = new URL(url).searchParams
  } catch {
    return null
  }

  const expires = params.get('expires')
  if (expires && /^\d+$/.test(expires)) return Number(expires) * 1000

  const amzDate = params.get('X-Amz-Date')
  const amzExpires = params.get('X-Amz-Expires')
  const match = amzDate?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (match && amzExpires && /^\d+$/.test(amzExpires)) {
    const [, y, mo, d, h, mi, s] = match.map(Number)
    return Date.UTC(y, mo - 1, d, h, mi, s) + Number(amzExpires) * 1000
  }

  return null
}

/**
 * The API's auth-checked download route. It mints a fresh short-lived link
 * on every request and forces the original filename, so — unlike the
 * attachment's own `url`, which is signed for 30 minutes when the message is
 * fetched — it never goes stale in a tab left open.
 */
export function attachmentDownloadUrl(attachmentId: string): string {
  return `${import.meta.env.VITE_API_BASE_URL as string}/attachments/${attachmentId}`
}
