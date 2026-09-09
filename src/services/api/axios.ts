import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

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

    // 401 anywhere except the auth bootstrap calls means the session is gone —
    // send the user to login (unless they're already on an auth screen).
    if (status === 401 && !AUTH_BOOTSTRAP.some((p) => url.includes(p))) {
      const path = window.location.pathname
      if (path !== '/login' && path !== '/register') {
        window.location.assign('/login')
      }
    }

    return Promise.reject(error)
  },
)

export default api
