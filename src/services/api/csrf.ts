import api from './axios'

let primed = false

/**
 * Fetch Sanctum's XSRF-TOKEN cookie. Cheap and idempotent — call before the
 * first mutating request (and again on a 419). `/sanctum/csrf-cookie` lives at
 * the app root, not under `/api`, so we point at VITE_BACKEND_URL for this one.
 */
export async function primeCsrf(force = false): Promise<void> {
  if (primed && !force) return
  await api.get('/sanctum/csrf-cookie', {
    baseURL: import.meta.env.VITE_BACKEND_URL,
  })
  primed = true
}
