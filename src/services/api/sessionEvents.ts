// A 401 from any authenticated request means the server no longer
// recognises this session. The API client can't show UI itself, so it
// reports here and AuthProvider (which can) decides what to do about it.

type Listener = () => void

const listeners = new Set<Listener>()

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifySessionExpired(): void {
  listeners.forEach((listener) => listener())
}
