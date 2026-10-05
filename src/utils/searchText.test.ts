import { afterEach, describe, expect, it, vi } from 'vitest'
import { highlightSegments, queryTerms, resultTime, snippetAround } from './searchText'

const marked = (text: string, query: string) =>
  highlightSegments(text, queryTerms(query))
    .filter((s) => s.match)
    .map((s) => s.text)

describe('queryTerms', () => {
  it('keeps words of 2+ characters, as the search itself requires', () => {
    expect(queryTerms('  a redis  ttl x ')).toEqual(['redis', 'ttl'])
  })
})

describe('highlightSegments', () => {
  it('marks every occurrence, case-insensitively, and keeps the original casing', () => {
    expect(marked('Redis heartbeats — redis is fine', 'REDIS')).toEqual(['Redis', 'redis'])
  })

  it('marks several words at once', () => {
    expect(marked('Are we still on a 30s TTL for the Redis presence keys?', 'redis ttl')).toEqual([
      'TTL',
      'Redis',
    ])
  })

  it('marks the start of a longer word (the search matches word forms too)', () => {
    expect(marked('Heartbeats look stable', 'heart')).toEqual(['Heart'])
  })

  it('never marks letters in the middle of a word', () => {
    expect(marked('The shuttle left', 'ttl')).toEqual([])
  })

  it('treats regex characters in the query literally', () => {
    expect(marked('Is (it) fine?', '(it)')).toEqual(['(it)'])
  })

  it('reassembles into exactly the original text', () => {
    const text = 'Killing Redis on purpose to check the offline fallback.'
    expect(highlightSegments(text, ['redis', 'check']).map((s) => s.text).join('')).toBe(text)
  })
})

describe('snippetAround', () => {
  const long = `${'Intro words that go on for a while before anything relevant is said '.repeat(2)}and then redis appears here.`

  it('leaves a message alone when the match is already near the start', () => {
    expect(snippetAround('Redis is up again', ['redis'])).toBe('Redis is up again')
  })

  it('starts a long message shortly before its first match, with an ellipsis', () => {
    const snippet = snippetAround(long, ['redis'])
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet).toContain('redis appears here.')
    expect(snippet.length).toBeLessThan(long.length)
  })

  it('collapses line breaks for a one-line result', () => {
    expect(snippetAround('line one\nline two', ['two'])).toBe('line one line two')
  })
})

describe('resultTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('says Today / Yesterday with the time, the weekday and date this year, and the year otherwise', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0))

    expect(resultTime(new Date(2026, 8, 24, 10, 2).toISOString())).toBe('Today 10:02')
    expect(resultTime(new Date(2026, 8, 23, 18, 40).toISOString())).toBe('Yesterday 18:40')
    expect(resultTime(new Date(2026, 8, 18, 9, 0).toISOString())).toBe('Fri 18 Sep')
    expect(resultTime(new Date(2025, 2, 3, 9, 0).toISOString())).toBe('3 Mar 2025')
  })
})
