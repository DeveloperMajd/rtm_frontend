import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useTypingIndicator from './useTypingIndicator'
import { AuthContext, type AuthContextType } from './useAuth'
import { tellRoom } from '../utils/roomEvents'

const auth = { user: { id: 'me', name: 'Me', email: 'me@example.com' } } as AuthContextType

const wrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
  </StrictMode>
)

/** Someone's typing ping, as useUserChannel hands it to the room. */
const ping = (conversationId: string, userId: string, name: string) =>
  act(() => tellRoom(conversationId, 'TypingIndicator', { user_id: userId, name }))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTypingIndicator', () => {
  it('says who’s typing in the open room, until they’ve gone quiet', () => {
    const { result } = renderHook(() => useTypingIndicator('c1'), { wrapper })

    ping('c1', 'jo', 'Jo')
    expect(result.current).toBe('Jo is typing...')

    act(() => vi.advanceTimersByTime(3000))
    expect(result.current).toBeNull()
  })

  it('takes no notice of someone typing in another conversation', () => {
    const { result } = renderHook(() => useTypingIndicator('c1'), { wrapper })

    ping('c2', 'jo', 'Jo')

    expect(result.current).toBeNull()
  })

  it('hears nothing in a group the viewer has left', () => {
    const { result } = renderHook(() => useTypingIndicator('c1', false), { wrapper })

    ping('c1', 'jo', 'Jo')

    expect(result.current).toBeNull()
  })

  it('stops listening when the room closes', () => {
    const { unmount } = renderHook(() => useTypingIndicator('c1'), { wrapper })
    unmount()
    const timers = vi.getTimerCount()

    ping('c1', 'jo', 'Jo')

    // A ping that was taken starts the wait for its typist to go quiet.
    expect(vi.getTimerCount()).toBe(timers)
  })
})
