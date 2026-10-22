import { useEffect, useMemo, useRef, useState } from 'react'
import { listenToRoom } from '../utils/roomEvents'
import useAuth from './useAuth'

const useTypingIndicator = (conversationId: string, enabled = true): string | null => {
  const { user: currentUser } = useAuth()
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    // A left/kicked member isn't sent anyone's typing any more — nothing to
    // listen for.
    if (!enabled) return

    // Handed over by useUserChannel, from the viewer's own channel.
    const stopListening = listenToRoom(conversationId, {
      TypingIndicator: ({ user_id, name }) => {
        if (user_id === currentUser?.id) return

        setTypingUsers((prev) => new Map(prev).set(user_id, name))

        const existing = timers.current.get(user_id)
        if (existing) clearTimeout(existing)

        const timer = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev)
            next.delete(user_id)
            return next
          })
          timers.current.delete(user_id)
        }, 3000)

        timers.current.set(user_id, timer)
      },
    })

    return () => {
      stopListening()
      timers.current.forEach(clearTimeout)
      timers.current.clear()
    }
  }, [conversationId, currentUser?.id, enabled])

  return useMemo(() => {
    const names = Array.from(typingUsers.values())
    if (names.length === 0) return null
    if (names.length === 1) return `${names[0]} is typing...`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
    return 'Several people are typing...'
  }, [typingUsers])
}

export default useTypingIndicator
