import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRecentSearches, rememberSearch } from './recentSearches'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('recent searches', () => {
  it('keeps the newest first', () => {
    rememberSearch('presence')
    rememberSearch('reverb deploy')

    expect(loadRecentSearches()).toEqual(['reverb deploy', 'presence'])
  })

  it('moves a repeated search to the front instead of listing it twice, ignoring case', () => {
    rememberSearch('heartbeat')
    rememberSearch('presence')
    rememberSearch('Heartbeat')

    expect(loadRecentSearches()).toEqual(['Heartbeat', 'presence'])
  })

  it('keeps only the last five', () => {
    for (const q of ['one', 'two', 'three', 'four', 'five', 'six']) rememberSearch(q)

    expect(loadRecentSearches()).toEqual(['six', 'five', 'four', 'three', 'two'])
  })

  it('ignores a blank search', () => {
    rememberSearch('   ')
    expect(loadRecentSearches()).toEqual([])
  })

  it('comes back empty rather than failing when storage holds something unexpected', () => {
    localStorage.setItem('rtm.recentSearches', '{not json')
    expect(loadRecentSearches()).toEqual([])

    localStorage.setItem('rtm.recentSearches', JSON.stringify(['ok', 42, null]))
    expect(loadRecentSearches()).toEqual(['ok'])
  })

  it('still works for this session when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(rememberSearch('presence')).toEqual(['presence'])
  })
})
