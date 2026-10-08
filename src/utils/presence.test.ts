import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { presenceLabel, presenceOf } from './presence'

describe('presenceOf', () => {
  it('goes by the status when the server gives one', () => {
    expect(presenceOf({ is_online: true, presence_status: 'away' })).toBe('away')
    expect(presenceOf({ is_online: true, presence_status: 'online' })).toBe('online')
    expect(presenceOf({ is_online: false, presence_status: 'offline' })).toBe('offline')
  })

  // A server from before away presence gives is_online alone.
  it('falls back to online or not', () => {
    expect(presenceOf({ is_online: true })).toBe('online')
    expect(presenceOf({ is_online: false })).toBe('offline')
    expect(presenceOf({})).toBe('offline')
  })
})

describe('presenceLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('says online, away, or when they were last seen', () => {
    expect(presenceLabel('online', '2026-10-08T09:00:00Z')).toBe('Online')
    expect(presenceLabel('away', '2026-10-08T09:00:00Z')).toBe('Away')
    expect(presenceLabel('offline', '2026-10-08T09:00:00Z')).toBe('Last seen about 3 hours ago')
    expect(presenceLabel('offline', null)).toBe('Offline')
  })
})
