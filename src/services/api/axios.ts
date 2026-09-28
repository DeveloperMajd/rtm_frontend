import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { notifySessionExpired } from './sessionEvents'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  // Send the X-XSRF-TOKEN header from the XSRF-TOKEN cookie. Needed once the
  // SPA and API are on different registrable domains (Sec-Fetch-Site is no
  // longer "same-site" then, so the same-site CSRF shortcut stops applying).
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

const AUTH_BOOTSTRAP = ['/auth/me', '/auth/login', '/auth/register']

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status
    const config = error.config as RetriableConfig | undefined
    const url = config?.url ?? ''

    // 419 = CSRF token mismatch/expired. Re-prime the cookie and retry once.
    if (status === 419 && config && !config._csrfRetried) {
      config._csrfRetried = true
      const { primeCsrf } = await import('./csrf')
      await primeCsrf(true)
      return api(config)
    }

    // 401 anywhere except the auth bootstrap calls means the session is gone.
    // This used to reload straight onto /login, throwing away whatever was
    // on screen; now the app says so over the page instead (see
    // SessionExpiredDialog) and the viewer signs back in from there.
    if (status === 401 && !AUTH_BOOTSTRAP.some((p) => url.includes(p))) {
      notifySessionExpired()
    }

    return Promise.reject(error)
  },
)

export default api
