import api from './axios'

const heartbeat = async (): Promise<void> => {
  await api.post('/presence/heartbeat')
}

// For an in-app action (explicit logout) where there's time to await a real
// request — must be called before anything invalidates the session.
const leave = async (): Promise<void> => {
  await api.post('/presence/leave')
}

// For abrupt teardown (tab close, navigating away) where the page may not
// survive long enough for a normal request. sendBeacon is fire-and-forget
// and can't carry custom headers, so it only works while the session is
// still valid — it must never be the only thing clearing presence on logout.
const leaveViaBeacon = (): void => {
  const url = `${import.meta.env.VITE_API_BASE_URL as string}/presence/leave`
  navigator.sendBeacon(url)
}

export { heartbeat, leave, leaveViaBeacon }
