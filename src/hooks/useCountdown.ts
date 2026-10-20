import { useCallback, useEffect, useState } from 'react'

/** A countdown in whole seconds: `start(n)` sets it going, and it ticks
 * down from the clock (so a throttled background tab still ends on time). */
export function useCountdown(): [number, (seconds: number) => void] {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (endsAt === null) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [endsAt])

  // Stable, so it can sit in an effect's dependencies.
  const start = useCallback((seconds: number) => {
    setEndsAt(Date.now() + seconds * 1000)
    setLeft(seconds)
  }, [])
  return [left, start]
}

/** `m:ss`, for "You can resend in 0:42". */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
