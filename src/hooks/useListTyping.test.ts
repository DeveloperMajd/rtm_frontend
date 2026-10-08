import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { TYPING_SHOWN_MS, forgetTyping, noteTyping, stopTyping, typingLabel, useListTyping } from './useListTyping'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => forgetTyping())
  vi.useRealTimers()
})

describe('useListTyping', () => {
  it('says who’s typing in a conversation, and only that one', () => {
    const { result } = renderHook(() => useListTyping('c1'))
    const other = renderHook(() => useListTyping('c2'))
    expect(result.current).toEqual([])

    act(() => noteTyping('c1', 'sam', 'Sam'))
    act(() => noteTyping('c1', 'robin', 'Robin'))

    expect(result.current).toEqual(['Sam', 'Robin'])
    expect(other.result.current).toEqual([])
  })

  it('lets go once they’ve gone quiet, and a new ping keeps them a while longer', () => {
    const { result } = renderHook(() => useListTyping('c1'))
    act(() => noteTyping('c1', 'sam', 'Sam'))

    act(() => void vi.advanceTimersByTime(TYPING_SHOWN_MS - 500))
    act(() => noteTyping('c1', 'sam', 'Sam'))
    act(() => void vi.advanceTimersByTime(TYPING_SHOWN_MS - 500))
    expect(result.current).toEqual(['Sam'])

    act(() => void vi.advanceTimersByTime(500))
    expect(result.current).toEqual([])
  })

  it('lets go at once when they stop, leaving anyone else', () => {
    const { result } = renderHook(() => useListTyping('c1'))
    act(() => noteTyping('c1', 'sam', 'Sam'))
    act(() => noteTyping('c1', 'robin', 'Robin'))

    act(() => stopTyping('c1', 'sam'))
    expect(result.current).toEqual(['Robin'])

    // Stopping someone who wasn't typing changes nothing.
    act(() => stopTyping('c1', 'nobody'))
    expect(result.current).toEqual(['Robin'])
  })

  it('forgets everyone, everywhere, when told to', () => {
    const { result } = renderHook(() => useListTyping('c1'))
    act(() => noteTyping('c1', 'sam', 'Sam'))

    act(() => forgetTyping())

    expect(result.current).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the same list between renders while nothing changes', () => {
    const { result, rerender } = renderHook(() => useListTyping('c1'))
    act(() => noteTyping('c1', 'sam', 'Sam'))
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})

describe('typingLabel', () => {
  it('says just “typing…” for a direct conversation, and who or how many for a group', () => {
    expect(typingLabel('direct', ['Sam'])).toBe('typing…')
    expect(typingLabel('group', ['Sam'])).toBe('Sam is typing…')
    expect(typingLabel('group', ['Sam', 'Robin'])).toBe('2 people typing…')
    expect(typingLabel('group', ['Sam', 'Robin', 'Ana'])).toBe('3 people typing…')
  })
})
