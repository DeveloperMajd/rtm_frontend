import { useEffect, useMemo, useRef, useState } from 'react'
import useEcho from './useEcho'
import useAuth from './useAuth'

const useTypingIndicator = (conversationId: string): string | null => {
  const echo = useEcho()
  const { user: currentUser } = useAuth()
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const channel = echo.private(`conversation.${conversationId}`)

    channel.listen(
      'TypingIndicator',
      ({ user_id, name }: { user_id: string; name: string }) => {
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
    )

    return () => {
      channel.stopListening('TypingIndicator')
      timers.current.forEach(clearTimeout)
      timers.current.clear()
    }
  }, [conversationId, echo, currentUser?.id])

  return useMemo(() => {
    const names = Array.from(typingUsers.values())
    if (names.length === 0) return null
    if (names.length === 1) return `${names[0]} is typing...`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
    return 'Several people are typing...'
  }, [typingUsers])
}

export default useTypingIndicator
