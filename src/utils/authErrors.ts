import { isAxiosError } from 'axios'

type ErrorBody = {
  message?: string
  errors?: Record<string, string[]>
  data?: { message?: string }
}

/** The API's first message for each field it rejected (422), keyed by
 * field — `{}` for any other failure. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!isAxiosError<ErrorBody>(err) || err.response?.status !== 422) return {}
  const out: Record<string, string> = {}
  for (const [field, messages] of Object.entries(err.response.data?.errors ?? {})) {
    if (messages[0]) out[field] = messages[0]
  }
  return out
}

export const statusOf = (err: unknown): number | undefined =>
  isAxiosError(err) ? err.response?.status : undefined

/** The message the API sent with a failure, in either of its two shapes. */
export function apiMessage(err: unknown): string | undefined {
  if (!isAxiosError<ErrorBody>(err)) return undefined
  return err.response?.data?.data?.message ?? err.response?.data?.message
}
